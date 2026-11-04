import { createServerFn } from '@tanstack/react-start'
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '@/server/db/client'
import { requireUser } from '@/server/auth/guards'
import { fail } from '@/server/http'
import { toActor } from '@/server/auth/session'
import { storage } from '@/server/storage'
import { deleteOwnPhoto, ModerationError } from '@/server/moderation/service'
import { buildSearchText } from '@/server/search'
import { logAction } from '@/server/moderation/log'
import { enqueuePhoto, ensureWorker } from '@/server/jobs/photos'
import { canDeletePhoto, canEditPhotoMetadata } from '@/lib/permissions'
import { isPubliclyVisible } from '@/lib/moderation'
import { photoSegment } from '@/lib/text'
import { photoMetaSchema } from '@/lib/schemas'
import type { Photo } from '@/server/db/schema'

async function privateThumb(photo: Photo): Promise<string | null> {
  if (photo.csamLockedAt) return null
  const v =
    photo.variants.find((x) => x.kind === 'thumb' && x.width === 480 && x.format === 'webp') ??
    photo.variants.find((x) => x.kind === 'thumb')
  return v ? storage().signedUrl(v.key, 900) : null
}

/** The signed-in photographer's photos with status, reasons and totals. */
export const listMyPhotos = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    ensureWorker()
    const db = await getDb()
    const rows = await db
      .select()
      .from(schema.photos)
      .where(eq(schema.photos.ownerId, context.user.id))
      .orderBy(desc(schema.photos.createdAt))
      .limit(200)
    const profileViews = await db
      .select({ n: count() })
      .from(schema.analyticsEvents)
      .where(and(eq(schema.analyticsEvents.photographerId, context.user.id), eq(schema.analyticsEvents.type, 'profile_view')))
      .get()
    const contacts = await db
      .select({ type: schema.analyticsEvents.type, n: count() })
      .from(schema.analyticsEvents)
      .where(
        and(
          eq(schema.analyticsEvents.photographerId, context.user.id),
          sql`${schema.analyticsEvents.type} in ('contact_whatsapp','contact_email')`,
        ),
      )
      .groupBy(schema.analyticsEvents.type)
    const photos = await Promise.all(
      rows.map(async (p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        processing: p.processing,
        hidden: p.hiddenAt !== null,
        rejectionReason: p.rejectionReason,
        rejectionNote: p.rejectionNote,
        deleteAfter: p.deleteAfter?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        approvedAt: p.approvedAt?.toISOString() ?? null,
        width: p.width,
        height: p.height,
        blur: p.blurDataUrl,
        thumb: await privateThumb(p),
        regionSlug: p.regionSlug,
        category: p.category,
        views: p.viewCount,
        contacts: p.contactCount,
        canDelete: canDeletePhoto(toActor(context.user), p) && p.hiddenReason !== 'urgent_report',
        canEdit: canEditPhotoMetadata(toActor(context.user), p),
        publicSegment: isPubliclyVisible({ ...p, ownerStatus: 'active' }) ? photoSegment(p.title, p.id) : null,
      })),
    )
    return {
      photos,
      totals: {
        views: rows.reduce((s, p) => s + p.viewCount, 0),
        contacts: contacts.reduce((s, c) => s + c.n, 0),
        whatsapp: contacts.find((c) => c.type === 'contact_whatsapp')?.n ?? 0,
        email: contacts.find((c) => c.type === 'contact_email')?.n ?? 0,
        profileViews: profileViews?.n ?? 0,
        published: rows.filter((p) => p.status === 'approved' && !p.hiddenAt).length,
        pending: rows.filter((p) => p.status === 'pending').length,
      },
    }
  })

export const deleteMyPhoto = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().regex(/^[a-z0-9]{16}$/) }))
  .handler(async ({ context, data }) => {
    const db = await getDb()
    const photo = await db.select().from(schema.photos).where(eq(schema.photos.id, data.id)).get()
    // Same response for "not yours" and "does not exist".
    if (!photo || photo.ownerId !== context.user.id) fail('not_found', 404)
    if (!canDeletePhoto(toActor(context.user), photo)) fail('forbidden', 403)
    try {
      await deleteOwnPhoto(context.user.id, photo)
    } catch (err) {
      if (err instanceof ModerationError) fail(err.code, 409)
      throw err
    }
    return { ok: true as const }
  })

export const getMyPhoto = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .validator(z.object({ id: z.string().regex(/^[a-z0-9]{16}$/) }))
  .handler(async ({ context, data }) => {
    const db = await getDb()
    const p = await db.select().from(schema.photos).where(eq(schema.photos.id, data.id)).get()
    if (!p || p.ownerId !== context.user.id) fail('not_found', 404)
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      tags: p.tags.join(', '),
      regionSlug: p.regionSlug,
      locationText: p.locationText,
      category: p.category,
      authorName: p.authorName,
      yearTaken: p.yearTaken,
      hasPeople: p.hasPeople,
      hasMinor: p.hasMinor,
      status: p.status,
      thumb: await privateThumb(p),
      canEdit: canEditPhotoMetadata(toActor(context.user), p),
    }
  })

/** Photographers may correct metadata while a photo is still pending review. */
export const updateMyPhoto = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator((input: unknown) => {
    const base = z.object({ id: z.string().regex(/^[a-z0-9]{16}$/), fields: z.record(z.string(), z.string()) }).parse(input)
    return { id: base.id, meta: photoMetaSchema().parse(base.fields) }
  })
  .handler(async ({ context, data }) => {
    const db = await getDb()
    const p = await db.select().from(schema.photos).where(eq(schema.photos.id, data.id)).get()
    if (!p || p.ownerId !== context.user.id) fail('not_found', 404)
    if (!canEditPhotoMetadata(toActor(context.user), p)) fail('forbidden', 403)
    const m = data.meta
    await db
      .update(schema.photos)
      .set({
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
        searchText: buildSearchText(m),
        // The watermark carries the author name: re-render if it changed.
        ...(m.authorName !== p.authorName ? { processing: 'queued' as const, processingAttempts: 0 } : {}),
      })
      .where(and(eq(schema.photos.id, p.id), eq(schema.photos.status, 'pending')))
    await logAction({ actorId: context.user.id, action: 'owner_edit', targetType: 'photo', targetId: p.id })
    if (m.authorName !== p.authorName) enqueuePhoto(p.id)
    return { ok: true as const }
  })
