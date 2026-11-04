import { and, count, eq } from 'drizzle-orm'
import { getDb, schema } from './db/client'
import { env } from './env'
import { newId, sha256Hex } from './crypto'
import { storage } from './storage'
import { getSessionUser, toActor } from './auth/session'
import { consumeAll } from './ratelimit'
import { requestIp } from './request'
import { ImageError, inspectImage } from './images/pipeline'
import { EXTENSION } from './images/sniff'
import { buildSearchText } from './search'
import { logAction } from './moderation/log'
import { enqueuePhoto } from './jobs/photos'
import { canUpload } from '@/lib/permissions'
import { orientationOf } from '@/lib/categories'
import { photoMetaSchema } from '@/lib/schemas'

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

const STATUS_FOR: Record<string, number> = {
  file_missing: 400,
  file_too_large: 413,
  file_too_many_pixels: 413,
  file_type: 415,
  file_heic: 415,
  file_animated: 415,
  file_corrupt: 422,
  resolution_too_low: 422,
}

/**
 * POST /api/photos/upload (multipart). Every upload starts PENDING and is
 * stored privately; nothing becomes public without an admin approval.
 */
export async function handleUpload(request: Request): Promise<Response> {
  const e = env()
  const user = await getSessionUser()
  if (!user) return json(401, { error: 'unauthorized' })
  if (!canUpload(toActor(user))) return json(403, { error: user.emailVerifiedAt ? 'forbidden' : 'email_unverified' })

  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > e.UPLOAD_MAX_BYTES + 512 * 1024) return json(413, { error: 'file_too_large' })

  const ip = requestIp()
  const limit = await consumeAll([
    { key: `upload:user:${user.id}:h`, limit: e.UPLOADS_PER_HOUR, windowSeconds: 3600 },
    { key: `upload:user:${user.id}:d`, limit: e.UPLOADS_PER_DAY, windowSeconds: 86_400 },
    { key: `upload:ip:${ip}:d`, limit: e.UPLOADS_PER_DAY * 2, windowSeconds: 86_400 },
  ])
  if (!limit.ok) return json(429, { error: 'upload_rate_limited', resetAt: limit.resetAt })

  const db = await getDb()
  const pending = await db
    .select({ n: count() })
    .from(schema.photos)
    .where(and(eq(schema.photos.ownerId, user.id), eq(schema.photos.status, 'pending')))
    .get()
  if ((pending?.n ?? 0) >= e.MAX_PENDING_PER_USER) return json(429, { error: 'too_many_pending' })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json(400, { error: 'invalid_input' })
  }
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) return json(400, { error: 'file_missing' })
  if (file.size > e.UPLOAD_MAX_BYTES) return json(413, { error: 'file_too_large' })

  const fields: Record<string, string> = {}
  for (const [k, v] of form.entries()) if (typeof v === 'string') fields[k] = v
  const meta = photoMetaSchema().safeParse(fields)
  if (!meta.success) {
    return json(400, {
      error: 'invalid_input',
      fields: meta.error.issues.map((i) => String(i.path[0] ?? '')).filter(Boolean),
    })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let inspected
  try {
    inspected = await inspectImage(buffer, {
      maxBytes: e.UPLOAD_MAX_BYTES,
      minLongEdge: e.UPLOAD_MIN_LONG_EDGE,
      minShortEdge: e.UPLOAD_MIN_SHORT_EDGE,
      maxPixels: e.UPLOAD_MAX_PIXELS,
    })
  } catch (err) {
    const code = err instanceof ImageError ? err.code : 'file_corrupt'
    return json(STATUS_FOR[code] ?? 422, { error: code })
  }

  const sha = sha256Hex(buffer)
  const sameFile = await db
    .select({ id: schema.photos.id, ownerId: schema.photos.ownerId, csam: schema.photos.csamLockedAt, status: schema.photos.status })
    .from(schema.photos)
    .where(eq(schema.photos.originalSha256, sha))
  if (sameFile.some((p) => p.csam)) {
    await logAction({
      actorId: null,
      action: 'blocked_upload_hash_match',
      targetType: 'user',
      targetId: user.id,
      details: { sha256: sha },
    })
    return json(422, { error: 'file_blocked' })
  }
  if (sameFile.some((p) => p.ownerId === user.id && ['pending', 'approved'].includes(p.status))) {
    return json(409, { error: 'duplicate_file' })
  }

  const id = newId()
  const key = `originals/${id}/${newId(20)}.${EXTENSION[inspected.mime]}`
  await storage().put(key, buffer, inspected.mime)

  const m = meta.data
  await db.insert(schema.photos).values({
    id,
    ownerId: user.id,
    title: m.title,
    description: m.description,
    tags: m.tags,
    regionSlug: m.regionSlug,
    locationText: m.locationText,
    category: m.category,
    authorName: m.authorName,
    yearTaken: m.yearTaken,
    hasPeople: m.hasPeople,
    hasMinor: m.hasMinor,
    confirmedRights: m.confirmRights,
    confirmedConsent: m.confirmConsent,
    confirmedRules: m.confirmRules,
    status: 'pending',
    processing: 'queued',
    width: inspected.width,
    height: inspected.height,
    orientation: orientationOf(inspected.width, inspected.height),
    originalKey: key,
    originalMime: inspected.mime,
    originalBytes: buffer.length,
    originalSha256: sha,
    publicToken: newId(12),
    searchText: buildSearchText(m),
  })
  const otherOwners = sameFile.filter((p) => p.ownerId !== user.id).map((p) => p.id)
  await logAction({
    actorId: user.id,
    action: 'upload',
    targetType: 'photo',
    targetId: id,
    details: {
      bytes: buffer.length,
      mime: inspected.mime,
      width: inspected.width,
      height: inspected.height,
      hasPeople: m.hasPeople,
      hasMinor: m.hasMinor,
      ...(otherOwners.length ? { sameFileAs: otherOwners } : {}),
    },
  })
  enqueuePhoto(id)
  return json(201, { id })
}

