import { createServerFn } from '@tanstack/react-start'
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, like, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '@/server/db/client'
import { requireAdmin } from '@/server/auth/guards'
import { fail } from '@/server/http'
import { storage } from '@/server/storage'
import { ensureWorker } from '@/server/jobs/photos'
import { env } from '@/server/env'
import {
  approvePhoto,
  childSafetyProcedure,
  closeReport,
  hidePhoto,
  ModerationError,
  reinstateUser,
  rejectPhoto,
  removePhoto,
  rerunAi,
  restorePhoto,
  retryProcessing,
  setFeatured,
  suspendUser,
} from '@/server/moderation/service'
import { logAction } from '@/server/moderation/log'
import { ALT_MAX, isUrgentForReview, shouldBlurForModerator } from '@/lib/moderation'
import { REJECTION_REASONS, type Photo } from '@/server/db/schema'
import { photoSegment } from '@/lib/text'

const id = z.string().regex(/^[a-z0-9]{16}$/)

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof ModerationError) fail(err.code, err.code === 'not_found' ? 404 : 409)
    throw err
  }
}

async function reviewPreviewUrl(p: Photo): Promise<string | null> {
  if (p.csamLockedAt) return null // nobody, including staff, can browse locked material
  const v = p.variants.find((x) => x.kind === 'review')
  return v ? storage().signedUrl(v.key, 900) : null
}

function summary(p: Photo, owner: { displayName: string | null; email: string; status: string }, reports: number) {
  return {
    id: p.id,
    title: p.title,
    authorName: p.authorName,
    ownerName: owner.displayName ?? '',
    ownerEmail: owner.email,
    ownerStatus: owner.status,
    regionSlug: p.regionSlug,
    locationText: p.locationText,
    category: p.category,
    yearTaken: p.yearTaken,
    hasPeople: p.hasPeople,
    hasMinor: p.hasMinor,
    status: p.status,
    processing: p.processing,
    processingError: p.processingError,
    hidden: p.hiddenAt !== null,
    hiddenReason: p.hiddenReason,
    csamLocked: p.csamLockedAt !== null,
    aiStatus: p.aiStatus,
    aiFlags: p.aiFlags ?? [],
    aiError: p.aiError,
    urgent: isUrgentForReview(p),
    blur: shouldBlurForModerator(p),
    width: p.width,
    height: p.height,
    createdAt: p.createdAt.toISOString(),
    reports,
    featured: p.featured,
  }
}

/* ---------------------------------------------------------------- stats */

export const adminStats = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async () => {
    ensureWorker()
    const db = await getDb()
    const byStatus = await db.select({ status: schema.photos.status, n: count() }).from(schema.photos).groupBy(schema.photos.status)
    const n = (s: string) => byStatus.find((r) => r.status === s)?.n ?? 0
    const one = async (q: Promise<{ n: number } | undefined>) => (await q)?.n ?? 0
    const since30 = new Date(Date.now() - 30 * 86_400_000)
    const since7 = new Date(Date.now() - 7 * 86_400_000)
    const [urgent, hidden, failed, openReports, users, suspended, photographers, uploads7, views30, contacts30] =
      await Promise.all([
        one(
          db
            .select({ n: count() })
            .from(schema.photos)
            .where(
              and(
                isNull(schema.photos.csamLockedAt),
                or(eq(schema.photos.hiddenReason, 'urgent_report'), like(schema.photos.aiFlags, '%sexual_minors%')),
              ),
            )
            .get(),
        ),
        one(db.select({ n: count() }).from(schema.photos).where(and(eq(schema.photos.status, 'approved'), isNotNull(schema.photos.hiddenAt))).get()),
        one(db.select({ n: count() }).from(schema.photos).where(eq(schema.photos.processing, 'failed')).get()),
        one(db.select({ n: count() }).from(schema.reports).where(eq(schema.reports.status, 'open')).get()),
        one(db.select({ n: count() }).from(schema.users).get()),
        one(db.select({ n: count() }).from(schema.users).where(eq(schema.users.status, 'suspended')).get()),
        one(
          db
            .select({ n: sql<number>`count(distinct ${schema.photos.ownerId})` })
            .from(schema.photos)
            .where(eq(schema.photos.status, 'approved'))
            .get(),
        ),
        one(db.select({ n: count() }).from(schema.photos).where(gte(schema.photos.createdAt, since7)).get()),
        one(
          db
            .select({ n: count() })
            .from(schema.analyticsEvents)
            .where(and(eq(schema.analyticsEvents.type, 'photo_view'), gte(schema.analyticsEvents.createdAt, since30)))
            .get(),
        ),
        one(
          db
            .select({ n: count() })
            .from(schema.analyticsEvents)
            .where(
              and(
                inArray(schema.analyticsEvents.type, ['contact_whatsapp', 'contact_email']),
                gte(schema.analyticsEvents.createdAt, since30),
              ),
            )
            .get(),
        ),
      ])
    return {
      photos: { pending: n('pending'), approved: n('approved'), rejected: n('rejected'), removed: n('removed') },
      urgent,
      hidden,
      failed,
      openReports,
      users,
      suspended,
      photographers,
      uploads7,
      views30,
      contacts30,
    }
  })

/* ---------------------------------------------------------------- queue */

export const QUEUE_FILTERS = ['pending', 'urgent', 'flagged', 'failed', 'hidden'] as const

export const reviewQueue = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .validator(z.object({ filter: z.enum(QUEUE_FILTERS).default('pending'), page: z.number().int().min(1).max(500).default(1) }))
  .handler(async ({ data }) => {
    ensureWorker()
    const db = await getDb()
    const where = {
      pending: and(eq(schema.photos.status, 'pending'), isNull(schema.photos.csamLockedAt)),
      urgent: and(
        isNull(schema.photos.csamLockedAt),
        inArray(schema.photos.status, ['pending', 'approved']),
        or(eq(schema.photos.hiddenReason, 'urgent_report'), like(schema.photos.aiFlags, '%sexual_minors%')),
      ),
      flagged: and(eq(schema.photos.status, 'pending'), eq(schema.photos.aiStatus, 'flagged')),
      failed: eq(schema.photos.processing, 'failed'),
      hidden: and(eq(schema.photos.status, 'approved'), isNotNull(schema.photos.hiddenAt), isNull(schema.photos.csamLockedAt)),
    }[data.filter]
    const pageSize = 24
    const rows = await db
      .select({
        photo: schema.photos,
        email: schema.users.email,
        ownerStatus: schema.users.status,
        displayName: schema.profiles.displayName,
        reports: sql<number>`(select count(*) from reports r where r.photo_id = ${schema.photos.id} and r.status = 'open')`,
      })
      .from(schema.photos)
      .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.photos.ownerId))
      .where(where)
      .orderBy(desc(sql`case when ${schema.photos.hiddenReason} = 'urgent_report' then 1 else 0 end`), asc(schema.photos.createdAt))
      .limit(pageSize + 1)
      .offset((data.page - 1) * pageSize)
    const items = await Promise.all(
      rows.slice(0, pageSize).map(async (r) => ({
        ...summary(r.photo, { displayName: r.displayName, email: r.email, status: r.ownerStatus }, Number(r.reports)),
        preview: await reviewPreviewUrl(r.photo),
      })),
    )
    return { items, hasMore: rows.length > pageSize, page: data.page, filter: data.filter }
  })

export const reviewItem = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .validator(z.object({ id }))
  .handler(async ({ data }) => {
    const db = await getDb()
    const r = await db
      .select({
        photo: schema.photos,
        email: schema.users.email,
        ownerStatus: schema.users.status,
        ownerSince: schema.users.createdAt,
        displayName: schema.profiles.displayName,
        slug: schema.profiles.slug,
      })
      .from(schema.photos)
      .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.photos.ownerId))
      .where(eq(schema.photos.id, data.id))
      .get()
    if (!r) fail('not_found', 404)
    const p = r.photo
    const reports = await db.select().from(schema.reports).where(eq(schema.reports.photoId, p.id)).orderBy(desc(schema.reports.createdAt))
    const log = await db
      .select()
      .from(schema.moderationLog)
      .where(and(eq(schema.moderationLog.targetType, 'photo'), eq(schema.moderationLog.targetId, p.id)))
      .orderBy(desc(schema.moderationLog.createdAt))
      .limit(50)
    const sameFile = await db
      .select({ id: schema.photos.id, ownerId: schema.photos.ownerId, status: schema.photos.status })
      .from(schema.photos)
      .where(and(eq(schema.photos.originalSha256, p.originalSha256), sql`${schema.photos.id} != ${p.id}`))
    const ownerPhotos = await db
      .select({ status: schema.photos.status, n: count() })
      .from(schema.photos)
      .where(eq(schema.photos.ownerId, p.ownerId))
      .groupBy(schema.photos.status)
    return {
      ...summary(p, { displayName: r.displayName, email: r.email, status: r.ownerStatus }, reports.filter((x) => x.status === 'open').length),
      ownerId: p.ownerId,
      ownerSlug: r.slug ?? '',
      ownerSince: r.ownerSince.toISOString(),
      ownerPhotos: Object.fromEntries(ownerPhotos.map((o) => [o.status, o.n])),
      description: p.description,
      tags: p.tags,
      altFr: p.altFr,
      altAr: p.altAr,
      altEn: p.altEn,
      bytes: p.originalBytes,
      mime: p.originalMime,
      preview: await reviewPreviewUrl(p),
      original: p.csamLockedAt ? null : await storage().signedUrl(p.originalKey, 600, { download: `soura-${p.id}` }),
      publicSegment: p.status === 'approved' ? photoSegment(p.title, p.id) : null,
      rejectionReason: p.rejectionReason,
      rejectionNote: p.rejectionNote,
      reports: reports.map((x) => ({
        id: x.id,
        reason: x.reason,
        details: x.details,
        source: x.source,
        reporterName: x.reporterName,
        reporterEmail: x.reporterEmail,
        status: x.status,
        createdAt: x.createdAt.toISOString(),
      })),
      log: log.map((l) => ({
        id: l.id,
        action: l.action,
        actorId: l.actorId,
        details: l.details,
        createdAt: l.createdAt.toISOString(),
      })),
      sameFile: sameFile.map((s) => ({ ...s, otherOwner: s.ownerId !== p.ownerId })),
      retentionDays: env().REJECTED_RETENTION_DAYS,
    }
  })

/* -------------------------------------------------------------- actions */

const note = z.string().max(1000).default('')

export const approve = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(
    z.object({
      id,
      altFr: z.string().max(ALT_MAX),
      altAr: z.string().max(ALT_MAX).default(''),
      altEn: z.string().max(ALT_MAX).default(''),
      featured: z.boolean().default(false),
      note,
    }),
  )
  .handler(async ({ context, data }) => {
    await run(() => approvePhoto(context.user.id, data.id, data))
    return { ok: true as const }
  })

export const reject = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id, reason: z.enum(REJECTION_REASONS), note }))
  .handler(async ({ context, data }) => {
    await run(() => rejectPhoto(context.user.id, data.id, data.reason, data.note))
    return { ok: true as const }
  })

export const hide = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id, note }))
  .handler(async ({ context, data }) => {
    await run(() => hidePhoto(context.user.id, data.id, 'admin', { note: data.note }))
    return { ok: true as const }
  })

export const restore = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id, note }))
  .handler(async ({ context, data }) => {
    await run(() => restorePhoto(context.user.id, data.id, data.note))
    return { ok: true as const }
  })

export const remove = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id, note }))
  .handler(async ({ context, data }) => {
    await run(() => removePhoto(context.user.id, data.id, data.note))
    return { ok: true as const }
  })

/** Requires typing the confirmation word — this action is irreversible from the app. */
export const childSafety = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id, confirm: z.literal('CSAM') }))
  .handler(async ({ context, data }) => {
    await run(() => childSafetyProcedure(context.user.id, data.id))
    return { ok: true as const }
  })

export const retry = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id }))
  .handler(async ({ context, data }) => {
    await run(() => retryProcessing(context.user.id, data.id))
    return { ok: true as const }
  })

export const rerunAiCheck = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id }))
  .handler(async ({ context, data }) => {
    await run(() => rerunAi(context.user.id, data.id))
    return { ok: true as const }
  })

export const feature = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id, featured: z.boolean() }))
  .handler(async ({ context, data }) => {
    await run(() => setFeatured(context.user.id, data.id, data.featured))
    return { ok: true as const }
  })

/* -------------------------------------------------------------- reports */

export const listReports = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .validator(z.object({ status: z.enum(['open', 'resolved', 'dismissed']).default('open') }))
  .handler(async ({ data }) => {
    const db = await getDb()
    const rows = await db
      .select({
        report: schema.reports,
        title: schema.photos.title,
        photoStatus: schema.photos.status,
        hidden: schema.photos.hiddenAt,
        hiddenReason: schema.photos.hiddenReason,
        csam: schema.photos.csamLockedAt,
      })
      .from(schema.reports)
      .leftJoin(schema.photos, eq(schema.photos.id, schema.reports.photoId))
      .where(eq(schema.reports.status, data.status))
      .orderBy(desc(sql`case when ${schema.reports.reason} = 'csam' then 1 else 0 end`), desc(schema.reports.createdAt))
      .limit(200)
    return rows.map((r) => ({
      id: r.report.id,
      photoId: r.report.photoId,
      reason: r.report.reason,
      details: r.report.details,
      source: r.report.source,
      reporterName: r.report.reporterName,
      reporterEmail: r.report.reporterEmail,
      photoUrl: r.report.photoUrl,
      status: r.report.status,
      resolution: r.report.resolution,
      createdAt: r.report.createdAt.toISOString(),
      photoTitle: r.title,
      photoStatus: r.photoStatus,
      photoHidden: r.hidden !== null,
      photoLocked: r.csam !== null,
    }))
  })

export const resolveReport = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ id, status: z.enum(['resolved', 'dismissed']), note }))
  .handler(async ({ context, data }) => {
    await run(() => closeReport(context.user.id, data.id, data.status, data.note))
    return { ok: true as const }
  })

/* ---------------------------------------------------------------- users */

export const listUsers = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .validator(z.object({ q: z.string().max(100).default(''), status: z.enum(['all', 'active', 'suspended']).default('all') }))
  .handler(async ({ data }) => {
    const db = await getDb()
    const q = data.q.trim().toLowerCase()
    const rows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        role: schema.users.role,
        status: schema.users.status,
        suspendedReason: schema.users.suspendedReason,
        verified: schema.users.emailVerifiedAt,
        createdAt: schema.users.createdAt,
        displayName: schema.profiles.displayName,
        slug: schema.profiles.slug,
        featured: schema.profiles.featured,
        photos: sql<number>`(select count(*) from photos p where p.owner_id = ${schema.users.id})`,
        approved: sql<number>`(select count(*) from photos p where p.owner_id = ${schema.users.id} and p.status = 'approved')`,
      })
      .from(schema.users)
      .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
      .where(
        and(
          q ? or(like(schema.users.email, `%${q}%`), like(sql`lower(${schema.profiles.displayName})`, `%${q}%`)) : undefined,
          data.status === 'all' ? undefined : eq(schema.users.status, data.status),
        ),
      )
      .orderBy(desc(schema.users.createdAt))
      .limit(200)
    return rows.map((r) => ({
      ...r,
      verified: r.verified !== null,
      createdAt: r.createdAt.toISOString(),
      photos: Number(r.photos),
      approved: Number(r.approved),
      featured: Boolean(r.featured),
    }))
  })

export const suspend = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ userId: id, reason: z.string().min(3).max(300) }))
  .handler(async ({ context, data }) => {
    if (data.userId === context.user.id) fail('forbidden', 403)
    await run(() => suspendUser(context.user.id, data.userId, data.reason))
    return { ok: true as const }
  })

export const reinstate = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ userId: id }))
  .handler(async ({ context, data }) => {
    await run(() => reinstateUser(context.user.id, data.userId))
    return { ok: true as const }
  })

export const featurePhotographer = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ userId: id, featured: z.boolean() }))
  .handler(async ({ context, data }) => {
    const db = await getDb()
    await db.update(schema.profiles).set({ featured: data.featured }).where(eq(schema.profiles.userId, data.userId))
    await logAction({
      actorId: context.user.id,
      action: data.featured ? 'feature_photographer' : 'unfeature_photographer',
      targetType: 'user',
      targetId: data.userId,
    })
    return { ok: true as const }
  })

/* ------------------------------------------------------------------ log */

export const listLog = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .validator(z.object({ page: z.number().int().min(1).max(1000).default(1) }))
  .handler(async ({ data }) => {
    const db = await getDb()
    const pageSize = 50
    const rows = await db
      .select({ log: schema.moderationLog, actorEmail: schema.users.email })
      .from(schema.moderationLog)
      .leftJoin(schema.users, eq(schema.users.id, schema.moderationLog.actorId))
      .orderBy(desc(schema.moderationLog.id))
      .limit(pageSize + 1)
      .offset((data.page - 1) * pageSize)
    return {
      entries: rows.slice(0, pageSize).map((r) => ({
        id: r.log.id,
        action: r.log.action,
        targetType: r.log.targetType,
        targetId: r.log.targetId,
        actor: r.actorEmail ?? (r.log.actorId ? r.log.actorId : null),
        details: r.log.details,
        createdAt: r.log.createdAt.toISOString(),
      })),
      hasMore: rows.length > pageSize,
      page: data.page,
    }
  })
