import { and, eq, inArray, lt, or } from 'drizzle-orm'
import { getDb, schema } from '../db/client'
import { env } from '../env'
import { storage } from '../storage'
import { renderDerivatives } from '../images/pipeline'
import { runAiCheck } from '../moderation/ai'
import { logAction } from '../moderation/log'
import { aiPatch } from '@/lib/moderation'
import type { PhotoVariant } from '../db/schema'

/**
 * In-process job runner for photo processing (single instance). Jobs are
 * claimed in the database, so a restart simply re-queues them: a periodic
 * sweep picks up "queued" photos and "processing" ones that went stale.
 */
const MAX_ATTEMPTS = 3
const STALE_MS = 10 * 60_000

type State = { queue: Array<string>; running: boolean; sweeper: ReturnType<typeof setInterval> | null }
const g = globalThis as unknown as { __souraJobs?: State }
const state: State = (g.__souraJobs ??= { queue: [], running: false, sweeper: null })

export function enqueuePhoto(photoId: string): void {
  if (!state.queue.includes(photoId)) state.queue.push(photoId)
  ensureWorker()
  void drain()
}

/** Starts the recovery sweep once per process (called lazily from request paths). */
export function ensureWorker(): void {
  if (state.sweeper || process.env.VITEST) return
  state.sweeper = setInterval(() => void sweep(), 60_000)
  state.sweeper.unref()
  void sweep()
}

async function sweep(): Promise<void> {
  try {
    const db = await getDb()
    const rows = await db
      .select({ id: schema.photos.id })
      .from(schema.photos)
      .where(
        or(
          eq(schema.photos.processing, 'queued'),
          and(
            eq(schema.photos.processing, 'processing'),
            lt(schema.photos.processingStartedAt, new Date(Date.now() - STALE_MS)),
          ),
        ),
      )
      .limit(20)
    for (const r of rows) if (!state.queue.includes(r.id)) state.queue.push(r.id)
    void drain()
  } catch (err) {
    console.error('[jobs] sweep failed', err)
  }
}

async function drain(): Promise<void> {
  if (state.running) return
  state.running = true
  try {
    while (state.queue.length > 0) {
      const id = state.queue.shift()!
      await processPhoto(id).catch((err: unknown) => console.error('[jobs] photo', id, err))
    }
  } finally {
    state.running = false
  }
}

/** Processes one photo: derivatives, then the advisory AI check. Exported for tests and scripts. */
export async function processPhoto(photoId: string): Promise<void> {
  const db = await getDb()
  // Claim the job atomically.
  const claimed = await db
    .update(schema.photos)
    .set({ processing: 'processing', processingStartedAt: new Date(), processingError: null })
    .where(
      and(
        eq(schema.photos.id, photoId),
        inArray(schema.photos.processing, ['queued', 'processing', 'failed']),
        lt(schema.photos.processingAttempts, MAX_ATTEMPTS),
      ),
    )
    .returning()
  const photo = claimed[0]
  if (!photo) return
  if (photo.csamLockedAt) {
    // Never generate viewable derivatives for locked material.
    await db.update(schema.photos).set({ processing: 'failed', processingError: 'locked' }).where(eq(schema.photos.id, photoId))
    return
  }
  await db
    .update(schema.photos)
    .set({ processingAttempts: photo.processingAttempts + 1 })
    .where(eq(schema.photos.id, photoId))

  const e = env()
  const store = storage()
  try {
    const original = await store.getBuffer(photo.originalKey)
    if (!original) throw new Error('original missing from storage')
    const rendered = await renderDerivatives(original, {
      authorName: photo.authorName,
      previewLongEdge: e.PREVIEW_LONG_EDGE,
      maxPixels: e.UPLOAD_MAX_PIXELS,
    })
    const variants: Array<PhotoVariant> = []
    for (const o of rendered.outputs) {
      const key = `derivatives/${photo.id}/${o.kind}-${o.width}.${o.format}`
      await store.put(key, o.buffer, o.format === 'jpeg' ? 'image/jpeg' : `image/${o.format}`)
      variants.push({ kind: o.kind, width: o.width, height: o.height, format: o.format, key, bytes: o.buffer.length })
    }
    await db
      .update(schema.photos)
      .set({ processing: 'ready', processingError: null, variants, blurDataUrl: rendered.blurDataUrl })
      .where(eq(schema.photos.id, photo.id))
    await logAction({ actorId: null, action: 'processing_ready', targetType: 'photo', targetId: photo.id })

    // Advisory AI pre-check (never changes status).
    const fresh = await db
      .select({ csamLockedAt: schema.photos.csamLockedAt })
      .from(schema.photos)
      .where(eq(schema.photos.id, photo.id))
      .get()
    const text = [photo.title, photo.description, photo.tags.join(' ')].join('\n')
    const outcome = await runAiCheck({ jpeg: rendered.aiJpeg, text }, { csamLocked: Boolean(fresh?.csamLockedAt) })
    await db.update(schema.photos).set(aiPatch(outcome)).where(eq(schema.photos.id, photo.id))
    await logAction({
      actorId: null,
      action: `ai_${outcome.kind === 'result' ? (outcome.flags.length ? 'flagged' : 'clear') : outcome.kind}`,
      targetType: 'photo',
      targetId: photo.id,
      details:
        outcome.kind === 'result'
          ? { provider: outcome.provider, flags: outcome.flags }
          : { provider: outcome.provider, ...(outcome.kind === 'error' ? { error: outcome.message } : {}) },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const attempts = photo.processingAttempts + 1
    await db
      .update(schema.photos)
      .set({ processing: attempts >= MAX_ATTEMPTS ? 'failed' : 'queued', processingError: message.slice(0, 300) })
      .where(eq(schema.photos.id, photo.id))
    await logAction({
      actorId: null,
      action: 'processing_failed',
      targetType: 'photo',
      targetId: photo.id,
      details: { error: message.slice(0, 300), attempt: attempts },
    })
  }
}

/** Re-runs only the AI check from the stored review derivative (admin action). */
export async function rerunAiCheck(photoId: string): Promise<void> {
  const db = await getDb()
  const photo = await db.select().from(schema.photos).where(eq(schema.photos.id, photoId)).get()
  if (!photo) return
  const review = photo.variants.find((v) => v.kind === 'review')
  if (photo.csamLockedAt || !review) {
    await db.update(schema.photos).set(aiPatch({ kind: 'skipped', provider: 'none' })).where(eq(schema.photos.id, photoId))
    return
  }
  const buf = await storage().getBuffer(review.key)
  if (!buf) return
  const sharp = (await import('sharp')).default
  const jpeg = await sharp(buf).resize({ width: 1024, height: 1024, fit: 'inside' }).jpeg({ quality: 80 }).toBuffer()
  const outcome = await runAiCheck(
    { jpeg, text: [photo.title, photo.description, photo.tags.join(' ')].join('\n') },
    { csamLocked: false },
  )
  await db.update(schema.photos).set(aiPatch(outcome)).where(eq(schema.photos.id, photoId))
}
