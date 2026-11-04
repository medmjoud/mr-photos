import { createServerFn } from '@tanstack/react-start'
import { and, eq, isNotNull } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '@/server/db/client'
import { requireAdmin, requireUser } from '@/server/auth/guards'
import { fail } from '@/server/http'
import { storage, deleteKeys } from '@/server/storage'
import { logAction } from '@/server/moderation/log'
import { newId } from '@/server/crypto'
import { regionSlugs } from '@/lib/regions'
import { cleanLine, cleanMultiline } from '@/lib/text'

export const getMyProfile = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = await getDb()
    const p = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, context.user.id)).get()
    if (!p) fail('not_found', 404)
    const avatarPreview =
      p.avatar && p.avatarStatus !== 'none' ? await storage().signedUrl(p.avatar.keys.s160, 900) : null
    return {
      slug: p.slug,
      displayName: p.displayName,
      bio: p.bio,
      regionSlug: p.regionSlug ?? '',
      city: p.city,
      website: p.website,
      instagram: p.instagram,
      // The owner may see their own contact details (never rendered publicly).
      whatsapp: p.whatsapp,
      contactEmail: p.contactEmail || context.user.email,
      showWhatsapp: p.showWhatsapp,
      showEmail: p.showEmail,
      avatarStatus: p.avatarStatus,
      avatarPreview,
    }
  })

const website = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === '' || /^https:\/\/[^\s]+\.[^\s]+$/i.test(v), 'https_only')
const instagram = z
  .string()
  .trim()
  .transform((v) => v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, ''))
  .pipe(z.string().regex(/^[A-Za-z0-9._]{0,30}$/))
/** E.164 digits without "+", e.g. 22236123456 (Mauritania +222). */
const whatsapp = z
  .string()
  .transform((v) => v.replace(/[\s().-]/g, '').replace(/^\+/, '').replace(/^00/, ''))
  .pipe(z.string().regex(/^(\d{8,15})?$/))

export const updateMyProfile = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(
    z
      .object({
        displayName: z.string().transform(cleanLine).pipe(z.string().min(2).max(60)),
        bio: z.string().max(1200).transform(cleanMultiline),
        regionSlug: z.union([z.enum(regionSlugs), z.literal('')]),
        city: z.string().transform(cleanLine).pipe(z.string().max(80)),
        website,
        instagram,
        whatsapp,
        contactEmail: z.union([z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254)), z.literal('')]),
        showWhatsapp: z.boolean(),
        showEmail: z.boolean(),
      })
      .refine((d) => !d.showWhatsapp || d.whatsapp !== '', { path: ['whatsapp'] })
      .refine((d) => !d.showEmail || d.contactEmail !== '', { path: ['contactEmail'] }),
  )
  .handler(async ({ context, data }) => {
    const db = await getDb()
    await db
      .update(schema.profiles)
      .set({ ...data, regionSlug: data.regionSlug || null })
      .where(eq(schema.profiles.userId, context.user.id))
    return { ok: true as const }
  })

/* --------------------------------------------- avatar review (admin) */

export const listPendingAvatars = createServerFn({ method: 'GET' })
  .middleware([requireAdmin])
  .handler(async () => {
    const db = await getDb()
    const rows = await db
      .select({ userId: schema.profiles.userId, displayName: schema.profiles.displayName, avatar: schema.profiles.avatar })
      .from(schema.profiles)
      .where(and(eq(schema.profiles.avatarStatus, 'pending'), isNotNull(schema.profiles.avatar)))
      .limit(50)
    return Promise.all(
      rows.map(async (r) => ({
        userId: r.userId,
        displayName: r.displayName,
        url: r.avatar ? await storage().signedUrl(r.avatar.keys.s480, 900) : null,
      })),
    )
  })

export const decideAvatar = createServerFn({ method: 'POST' })
  .middleware([requireAdmin])
  .validator(z.object({ userId: z.string().regex(/^[a-z0-9]{16}$/), approve: z.boolean() }))
  .handler(async ({ context, data }) => {
    const db = await getDb()
    const p = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, data.userId)).get()
    if (!p?.avatar) fail('not_found', 404)
    if (data.approve) {
      await db
        .update(schema.profiles)
        .set({ avatarStatus: 'approved', avatar: { ...p.avatar, token: newId(12) } })
        .where(eq(schema.profiles.userId, data.userId))
    } else {
      await deleteKeys([p.avatar.keys.s160, p.avatar.keys.s480])
      await db.update(schema.profiles).set({ avatarStatus: 'rejected', avatar: null }).where(eq(schema.profiles.userId, data.userId))
    }
    await logAction({
      actorId: context.user.id,
      action: data.approve ? 'approve_avatar' : 'reject_avatar',
      targetType: 'avatar',
      targetId: data.userId,
    })
    return { ok: true as const }
  })
