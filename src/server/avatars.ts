import { eq } from 'drizzle-orm'
import { getDb, schema } from './db/client'
import { env } from './env'
import { newId } from './crypto'
import { deleteKeys, storage } from './storage'
import { getSessionUser, toActor } from './auth/session'
import { consumeAll } from './ratelimit'
import { ImageError, inspectImage, renderAvatar } from './images/pipeline'
import { logAction } from './moderation/log'
import { canManageOwnProfile } from '@/lib/permissions'

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

/** POST /api/profile/avatar — processed server-side, private until an admin approves it. */
export async function handleAvatarUpload(request: Request): Promise<Response> {
  const user = await getSessionUser()
  if (!user || !canManageOwnProfile(toActor(user))) return json(401, { error: 'unauthorized' })
  const limit = await consumeAll([{ key: `avatar:user:${user.id}`, limit: 6, windowSeconds: 86_400 }])
  if (!limit.ok) return json(429, { error: 'upload_rate_limited' })
  const e = env()
  if (Number(request.headers.get('content-length') ?? 0) > 10 * 1024 * 1024) return json(413, { error: 'file_too_large' })
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json(400, { error: 'invalid_input' })
  }
  const file = form.get('file')
  if (!(file instanceof File)) return json(400, { error: 'file_missing' })
  const buf = Buffer.from(await file.arrayBuffer())
  try {
    await inspectImage(buf, { maxBytes: 10 * 1024 * 1024, minLongEdge: 320, minShortEdge: 320, maxPixels: e.UPLOAD_MAX_PIXELS })
  } catch (err) {
    return json(422, { error: err instanceof ImageError ? err.code : 'file_corrupt' })
  }
  const out = await renderAvatar(buf, e.UPLOAD_MAX_PIXELS)
  const base = `avatars/${user.id}/${newId(12)}`
  const keys = { s160: `${base}-160.webp`, s480: `${base}-480.webp` }
  await storage().put(keys.s160, out.s160, 'image/webp')
  await storage().put(keys.s480, out.s480, 'image/webp')
  const db = await getDb()
  const prev = await db.select({ avatar: schema.profiles.avatar }).from(schema.profiles).where(eq(schema.profiles.userId, user.id)).get()
  await db
    .update(schema.profiles)
    .set({ avatarStatus: 'pending', avatar: { token: newId(12), blur: out.blurDataUrl, keys } })
    .where(eq(schema.profiles.userId, user.id))
  if (prev?.avatar) await deleteKeys([prev.avatar.keys.s160, prev.avatar.keys.s480])
  await logAction({ actorId: user.id, action: 'avatar_upload', targetType: 'avatar', targetId: user.id })
  return json(201, { ok: true })
}
