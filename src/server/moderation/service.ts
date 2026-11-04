import { and, eq, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm'
import { getDb, schema } from '../db/client'
import { env } from '../env'
import { newId } from '../crypto'
import { deleteKeys, storage } from '../storage'
import { purgeUrls } from '../cdn'
import { revokeAllSessions } from '../auth/session'
import { sendApprovedEmail, sendRejectedEmail, sendUrgentReportAlert } from '../email'
import { serverTranslator } from '@/i18n/server'
import { photoMediaPath } from '@/lib/media'
import { photoSegment } from '@/lib/text'
import {
  approvalBlockers,
  autoHideDecision,
  canTransition,
  retentionDeadline,
  type ModerationFacts,
} from '@/lib/moderation'
import { logAction } from './log'
import { enqueuePhoto, rerunAiCheck } from '../jobs/photos'
import type { HiddenReason, JsonValue, Photo, RejectionReason, ReportReason } from '../db/schema'

export class ModerationError extends Error {
  constructor(public code: string) {
    super(code)
  }
}

async function loadPhoto(photoId: string) {
  const db = await getDb()
  const row = await db
    .select({ photo: schema.photos, ownerStatus: schema.users.status, ownerEmail: schema.users.email, ownerLocale: schema.users.locale })
    .from(schema.photos)
    .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
    .where(eq(schema.photos.id, photoId))
    .get()
  if (!row) throw new ModerationError('not_found')
  return row
}

function facts(photo: Photo, ownerStatus: 'active' | 'suspended'): ModerationFacts {
  return {
    status: photo.status,
    processing: photo.processing,
    hiddenAt: photo.hiddenAt,
    csamLockedAt: photo.csamLockedAt,
    altFr: photo.altFr,
    ownerStatus,
  }
}

/** Public URLs that may be cached for a photo (used for CDN purge). */
function publicPaths(photo: Photo): Array<string> {
  return photo.variants
    .filter((v) => v.kind !== 'review')
    .map((v) => photoMediaPath(photo.id, photo.publicToken, v.kind as 'thumb', v.width, v.format as 'webp'))
}

async function ownerName(userId: string): Promise<string> {
  const db = await getDb()
  const p = await db
    .select({ displayName: schema.profiles.displayName })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .get()
  return p?.displayName ?? ''
}

/* ------------------------------------------------------------ approve */

export async function approvePhoto(
  actorId: string,
  photoId: string,
  input: { altFr: string; altAr: string; altEn: string; featured: boolean; note?: string },
): Promise<void> {
  const { photo, ownerStatus, ownerEmail, ownerLocale } = await loadPhoto(photoId)
  const blockers = approvalBlockers(facts(photo, ownerStatus), input.altFr)
  if (blockers.length) throw new ModerationError(`cannot_approve:${blockers.join(',')}`)
  const db = await getDb()
  const now = new Date()
  const res = await db
    .update(schema.photos)
    .set({
      status: 'approved',
      approvedAt: now,
      approvedBy: actorId,
      altFr: input.altFr.trim(),
      altAr: input.altAr.trim(),
      altEn: input.altEn.trim(),
      featured: input.featured,
      hiddenAt: null,
      hiddenReason: null,
      rejectionReason: null,
      rejectionNote: null,
      deleteAfter: null,
    })
    // Optimistic guard against concurrent moderation.
    .where(and(eq(schema.photos.id, photoId), eq(schema.photos.status, 'pending')))
    .returning({ id: schema.photos.id })
  if (!res.length) throw new ModerationError('conflict')
  await logAction({
    actorId,
    action: 'approve',
    targetType: 'photo',
    targetId: photoId,
    details: { featured: input.featured, note: input.note ?? null, ai: photo.aiStatus },
  })
  const { locale } = serverTranslator(ownerLocale)
  await sendApprovedEmail(
    ownerEmail,
    await ownerName(photo.ownerId),
    ownerLocale,
    photo.title,
    `/${locale}/photos/${photoSegment(photo.title, photo.id)}`,
  )
}

/* ------------------------------------------------------------- reject */

export async function rejectPhoto(actorId: string, photoId: string, reason: RejectionReason, note: string): Promise<void> {
  const { photo, ownerEmail, ownerLocale } = await loadPhoto(photoId)
  if (!canTransition('reject', photo.status)) throw new ModerationError('invalid_transition')
  if (photo.csamLockedAt) throw new ModerationError('csam_locked')
  const db = await getDb()
  const now = new Date()
  const days = env().REJECTED_RETENTION_DAYS
  await db
    .update(schema.photos)
    .set({
      status: 'rejected',
      rejectionReason: reason,
      rejectionNote: note.trim() || null,
      rejectedAt: now,
      deleteAfter: retentionDeadline(now, days),
      featured: false,
    })
    .where(eq(schema.photos.id, photoId))
  await logAction({ actorId, action: 'reject', targetType: 'photo', targetId: photoId, details: { reason, note } })
  const { t } = serverTranslator(ownerLocale)
  await sendRejectedEmail(
    ownerEmail,
    await ownerName(photo.ownerId),
    ownerLocale,
    photo.title,
    t(`moderation.rejection.${reason}`),
    note.trim(),
    days,
  )
}

/* ------------------------------------------------- hide / restore / remove */

export async function hidePhoto(actorId: string | null, photoId: string, reason: HiddenReason, details?: Record<string, JsonValue>) {
  const { photo } = await loadPhoto(photoId)
  if (photo.hiddenAt) return
  const db = await getDb()
  await db
    .update(schema.photos)
    .set({ hiddenAt: new Date(), hiddenReason: reason, publicToken: newId(12), featured: false })
    .where(eq(schema.photos.id, photoId))
  await purgeUrls(publicPaths(photo))
  await logAction({
    actorId,
    action: actorId ? 'hide' : `auto_hide_${reason}`,
    targetType: 'photo',
    targetId: photoId,
    details,
  })
}

/** Makes a hidden approved photo public again and dismisses its open reports. */
export async function restorePhoto(actorId: string, photoId: string, note: string) {
  const { photo, ownerStatus } = await loadPhoto(photoId)
  if (!canTransition('restore', photo.status)) throw new ModerationError('invalid_transition')
  if (photo.csamLockedAt) throw new ModerationError('csam_locked')
  if (ownerStatus !== 'active') throw new ModerationError('owner_suspended')
  const db = await getDb()
  await db.update(schema.photos).set({ hiddenAt: null, hiddenReason: null }).where(eq(schema.photos.id, photoId))
  await closeReports(actorId, photoId, 'dismissed', note || 'restored')
  await logAction({ actorId, action: 'restore', targetType: 'photo', targetId: photoId, details: { note } })
}

/** Takes a photo down permanently (e.g. a valid report). Files are deleted after the retention period. */
export async function removePhoto(actorId: string, photoId: string, note: string) {
  const { photo } = await loadPhoto(photoId)
  if (!canTransition('remove', photo.status)) throw new ModerationError('invalid_transition')
  const db = await getDb()
  const now = new Date()
  await db
    .update(schema.photos)
    .set({
      status: 'removed',
      hiddenAt: photo.hiddenAt ?? now,
      hiddenReason: photo.hiddenReason ?? 'admin',
      publicToken: newId(12),
      featured: false,
      rejectionNote: note.trim() || null,
      deleteAfter: retentionDeadline(now, env().REJECTED_RETENTION_DAYS),
    })
    .where(eq(schema.photos.id, photoId))
  await purgeUrls(publicPaths(photo))
  await closeReports(actorId, photoId, 'resolved', note || 'removed')
  await logAction({ actorId, action: 'remove', targetType: 'photo', targetId: photoId, details: { note } })
}

export async function setFeatured(actorId: string, photoId: string, featured: boolean) {
  const db = await getDb()
  await db.update(schema.photos).set({ featured }).where(and(eq(schema.photos.id, photoId), eq(schema.photos.status, 'approved')))
  await logAction({ actorId, action: featured ? 'feature' : 'unfeature', targetType: 'photo', targetId: photoId })
}

export async function retryProcessing(actorId: string, photoId: string) {
  const { photo } = await loadPhoto(photoId)
  if (photo.csamLockedAt) throw new ModerationError('csam_locked')
  const db = await getDb()
  await db
    .update(schema.photos)
    .set({ processing: 'queued', processingAttempts: 0, processingError: null })
    .where(eq(schema.photos.id, photoId))
  await logAction({ actorId, action: 'retry_processing', targetType: 'photo', targetId: photoId })
  enqueuePhoto(photoId)
}

export async function rerunAi(actorId: string, photoId: string) {
  const { photo } = await loadPhoto(photoId)
  if (photo.csamLockedAt) throw new ModerationError('csam_locked')
  await logAction({ actorId, action: 'rerun_ai', targetType: 'photo', targetId: photoId })
  await rerunAiCheck(photoId)
}

/* --------------------------------------------------------------- reports */

export async function createReport(input: {
  photoId: string | null
  reason: ReportReason
  details: string
  reporterHash: string
  source: 'button' | 'takedown_form'
  reporterName?: string
  reporterEmail?: string
  photoUrl?: string
}): Promise<{ id: string; hidden: boolean }> {
  const db = await getDb()
  const id = newId()
  await db.insert(schema.reports).values({
    id,
    photoId: input.photoId,
    reason: input.reason,
    details: input.details,
    reporterHash: input.reporterHash,
    source: input.source,
    reporterName: input.reporterName ?? '',
    reporterEmail: input.reporterEmail ?? '',
    photoUrl: input.photoUrl ?? '',
  })
  await logAction({
    actorId: null,
    action: 'report_received',
    targetType: 'report',
    targetId: id,
    details: { photoId: input.photoId, reason: input.reason, source: input.source },
  })
  if (!input.photoId) return { id, hidden: false }

  const photo = await db.select().from(schema.photos).where(eq(schema.photos.id, input.photoId)).get()
  if (!photo) return { id, hidden: false }
  const distinct = await db
    .select({ n: sql<number>`count(distinct ${schema.reports.reporterHash})` })
    .from(schema.reports)
    .where(and(eq(schema.reports.photoId, input.photoId), eq(schema.reports.status, 'open')))
    .get()
  const decision = autoHideDecision({
    newReason: input.reason,
    distinctOpenReporters: Number(distinct?.n ?? 0),
    threshold: env().REPORT_AUTOHIDE_THRESHOLD,
    alreadyHidden: photo.hiddenAt !== null,
  })
  if (decision.hide && decision.reason) {
    await hidePhoto(null, photo.id, decision.reason, { reportId: id, reporters: Number(distinct?.n ?? 0) })
    if (decision.reason === 'urgent_report') await sendUrgentReportAlert()
  }
  return { id, hidden: decision.hide }
}

export async function closeReports(actorId: string, photoId: string, status: 'resolved' | 'dismissed', resolution: string) {
  const db = await getDb()
  await db
    .update(schema.reports)
    .set({ status, resolution, resolvedAt: new Date(), resolvedBy: actorId })
    .where(and(eq(schema.reports.photoId, photoId), eq(schema.reports.status, 'open')))
}

export async function closeReport(actorId: string, reportId: string, status: 'resolved' | 'dismissed', resolution: string) {
  const db = await getDb()
  await db
    .update(schema.reports)
    .set({ status, resolution, resolvedAt: new Date(), resolvedBy: actorId })
    .where(eq(schema.reports.id, reportId))
  await logAction({ actorId, action: `report_${status}`, targetType: 'report', targetId: reportId, details: { resolution } })
}

/* ------------------------------------------------------------ accounts */

export async function suspendUser(actorId: string, userId: string, reason: string) {
  const db = await getDb()
  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get()
  if (!user) throw new ModerationError('not_found')
  if (user.role === 'admin') throw new ModerationError('cannot_suspend_admin')
  await db
    .update(schema.users)
    .set({ status: 'suspended', suspendedReason: reason.slice(0, 300), suspendedAt: new Date() })
    .where(eq(schema.users.id, userId))
  await revokeAllSessions(userId)
  // Public queries exclude suspended owners; rotate tokens so cached media URLs die too.
  const owned = await db
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.ownerId, userId), eq(schema.photos.status, 'approved')))
  for (const p of owned) {
    await db.update(schema.photos).set({ publicToken: newId(12), featured: false }).where(eq(schema.photos.id, p.id))
    await purgeUrls(publicPaths(p))
  }
  await db.update(schema.profiles).set({ featured: false }).where(eq(schema.profiles.userId, userId))
  await logAction({ actorId, action: 'suspend_user', targetType: 'user', targetId: userId, details: { reason } })
}

export async function reinstateUser(actorId: string, userId: string) {
  const db = await getDb()
  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get()
  if (!user) throw new ModerationError('not_found')
  if (user.suspendedReason === 'csam_procedure') throw new ModerationError('csam_hold')
  await db
    .update(schema.users)
    .set({ status: 'active', suspendedReason: null, suspendedAt: null })
    .where(eq(schema.users.id, userId))
  await logAction({ actorId, action: 'reinstate_user', targetType: 'user', targetId: userId })
}

/* ---------------------------------------------- child-safety procedure */

/**
 * Suspected child sexual abuse material. LEGAL REVIEW REQUIRED — see
 * docs/MODERATION.md. Immediately and irreversibly (from the app):
 *  1. blocks public access (hidden + status removed + token rotated + CDN purge);
 *  2. deletes every viewable derivative so staff cannot browse it;
 *  3. moves the original to a restricted prefix under legal hold (preserved
 *     for the authorities, never served by the app, never deleted by retention);
 *  4. suspends the uploader and revokes their sessions;
 *  5. closes related reports and logs everything.
 * The file is never sent to any AI provider after this point.
 */
export async function childSafetyProcedure(actorId: string, photoId: string): Promise<void> {
  const { photo } = await loadPhoto(photoId)
  if (photo.csamLockedAt) return
  const db = await getDb()
  const now = new Date()
  const store = storage()
  const oldPaths = publicPaths(photo)

  const viewable = photo.variants.map((v) => v.key)
  const restrictedKey = `restricted/${photo.id}/${newId(20)}.bin`
  let originalKey = photo.originalKey
  try {
    await store.move(photo.originalKey, restrictedKey)
    originalKey = restrictedKey
  } catch (err) {
    console.error('[csam] could not move original', err)
  }

  await db
    .update(schema.photos)
    .set({
      status: 'removed',
      csamLockedAt: now,
      csamLockedBy: actorId,
      legalHold: true,
      hiddenAt: photo.hiddenAt ?? now,
      hiddenReason: 'csam',
      publicToken: newId(12),
      featured: false,
      variants: [],
      blurDataUrl: null,
      originalKey,
      deleteAfter: null,
      aiStatus: photo.aiStatus === 'not_run' ? 'skipped' : photo.aiStatus,
    })
    .where(eq(schema.photos.id, photoId))
  await deleteKeys(viewable)
  await purgeUrls(oldPaths)

  const owner = await db.select().from(schema.users).where(eq(schema.users.id, photo.ownerId)).get()
  if (owner && owner.role !== 'admin') {
    await db
      .update(schema.users)
      .set({ status: 'suspended', suspendedReason: 'csam_procedure', suspendedAt: now })
      .where(eq(schema.users.id, owner.id))
    await revokeAllSessions(owner.id)
    await db.update(schema.profiles).set({ featured: false }).where(eq(schema.profiles.userId, owner.id))
  }
  await closeReports(actorId, photoId, 'resolved', 'child_safety_procedure')
  await logAction({
    actorId,
    action: 'child_safety_procedure',
    targetType: 'photo',
    targetId: photoId,
    details: {
      ownerId: photo.ownerId,
      sha256: photo.originalSha256,
      restrictedKey: originalKey === restrictedKey ? restrictedKey : null,
      uploadedAt: photo.createdAt.toISOString(),
    },
  })
}

/* -------------------------------------------------------- retention */

/** Deletes files of rejected/removed photos past their retention date (never under legal hold). */
export async function runRetentionCleanup(): Promise<{ photos: number }> {
  const db = await getDb()
  const due = await db
    .select()
    .from(schema.photos)
    .where(
      and(
        inArray(schema.photos.status, ['rejected', 'removed']),
        isNotNull(schema.photos.deleteAfter),
        lt(schema.photos.deleteAfter, new Date()),
        eq(schema.photos.legalHold, false),
        sql`${schema.photos.csamLockedAt} is null`,
      ),
    )
    .limit(200)
  for (const p of due) {
    await deleteKeys([p.originalKey, ...p.variants.map((v) => v.key)])
    await db.delete(schema.photos).where(and(eq(schema.photos.id, p.id), eq(schema.photos.legalHold, false)))
    await logAction({ actorId: null, action: 'retention_delete', targetType: 'photo', targetId: p.id, details: { status: p.status } })
  }
  return { photos: due.length }
}

/** Owner deletes their own photo: files removed now (unless under legal hold). */
export async function deleteOwnPhoto(actorId: string, photo: Photo) {
  const db = await getDb()
  // Evidence under an urgent report must survive until an admin has decided.
  if (photo.legalHold || photo.csamLockedAt || photo.hiddenReason === 'urgent_report') {
    throw new ModerationError('legal_hold')
  }
  await db.delete(schema.photos).where(and(eq(schema.photos.id, photo.id), ne(schema.photos.legalHold, true)))
  await deleteKeys([photo.originalKey, ...photo.variants.map((v) => v.key)])
  await purgeUrls(publicPaths(photo))
  await logAction({ actorId, action: 'owner_delete', targetType: 'photo', targetId: photo.id, details: { status: photo.status } })
}
