import { eq } from 'drizzle-orm'
import { getDb, schema } from './db/client'
import { storage, verifyLocalSignature } from './storage'
import { mediaContentType } from './images/pipeline'
import { isPubliclyVisible } from '@/lib/moderation'

const NOT_FOUND = () =>
  new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } })

const FILE_RE = /^(thumb|preview|og)-(\d{2,5})\.(avif|webp|jpeg)$/

/**
 * GET /media/p/:photoId/:token/:file — public derivatives of APPROVED,
 * visible photos only. Pending/rejected/hidden photos, wrong tokens and
 * private variants (review copies, originals) all return the same 404.
 */
export async function servePhotoMedia(photoId: string, token: string, file: string): Promise<Response> {
  const m = FILE_RE.exec(file)
  if (!m || !/^[a-z0-9]{16}$/.test(photoId) || !/^[a-z0-9]{12}$/.test(token)) return NOT_FOUND()
  const [, kind, width, format] = m
  const db = await getDb()
  const row = await db
    .select({ photo: schema.photos, ownerStatus: schema.users.status })
    .from(schema.photos)
    .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
    .where(eq(schema.photos.id, photoId))
    .get()
  if (!row) return NOT_FOUND()
  const { photo, ownerStatus } = row
  if (photo.publicToken !== token) return NOT_FOUND()
  if (!isPubliclyVisible({ ...photo, ownerStatus })) return NOT_FOUND()
  const variant = photo.variants.find(
    (v) => v.kind === kind && v.kind !== 'review' && String(v.width) === width && v.format === format,
  )
  if (!variant) return NOT_FOUND()
  const obj = await storage().get(variant.key)
  if (!obj) return NOT_FOUND()
  return new Response(obj.body, {
    headers: {
      'Content-Type': mediaContentType(variant.format),
      'Content-Length': String(obj.size || variant.bytes),
      // URLs embed a token that rotates when a photo is hidden; a CDN purge runs too.
      'Cache-Control': 'public, max-age=86400',
      'Content-Disposition': 'inline',
    },
  })
}

const AVATAR_RE = /^([a-z0-9]{12})-(160|480)\.webp$/

export async function serveAvatar(userId: string, file: string): Promise<Response> {
  const m = AVATAR_RE.exec(file)
  if (!m || !/^[a-z0-9]{16}$/.test(userId)) return NOT_FOUND()
  const db = await getDb()
  const row = await db
    .select({ profile: schema.profiles, status: schema.users.status })
    .from(schema.profiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
    .where(eq(schema.profiles.userId, userId))
    .get()
  const avatar = row?.profile.avatar
  if (!row || row.status !== 'active' || row.profile.avatarStatus !== 'approved' || !avatar) return NOT_FOUND()
  if (avatar.token !== m[1]) return NOT_FOUND()
  const obj = await storage().get(m[2] === '160' ? avatar.keys.s160 : avatar.keys.s480)
  if (!obj) return NOT_FOUND()
  return new Response(obj.body, {
    headers: { 'Content-Type': 'image/webp', 'Content-Length': String(obj.size), 'Cache-Control': 'public, max-age=86400' },
  })
}

/**
 * GET /files/:key?exp&sig[&dl] — local-driver signed URLs for private files
 * (originals, pending previews). Restricted (legal hold) material is never served.
 */
export async function serveSignedFile(key: string, url: URL): Promise<Response> {
  if (key.startsWith('restricted/')) return NOT_FOUND()
  const exp = Number(url.searchParams.get('exp'))
  const sig = url.searchParams.get('sig') ?? ''
  const dl = url.searchParams.get('dl') ?? undefined
  if (!verifyLocalSignature(key, exp, sig, dl)) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
  const obj = await storage().get(key)
  if (!obj) return NOT_FOUND()
  const headers: Record<string, string> = {
    'Content-Type': obj.contentType,
    'Content-Length': String(obj.size),
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex',
  }
  if (dl) headers['Content-Disposition'] = `attachment; filename="${dl.replace(/[^a-zA-Z0-9._-]/g, '_')}"`
  return new Response(obj.body, { headers })
}
