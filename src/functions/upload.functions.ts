import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { requireUser } from '@/server/auth/guards'
import { env } from '@/server/env'
import { getDb, schema } from '@/server/db/client'

/** Limits shown in the upload UI (the server enforces them independently). */
export const getUploadConfig = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const e = env()
    const db = await getDb()
    const profile = await db
      .select({ displayName: schema.profiles.displayName })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, context.user.id))
      .get()
    return {
      maxBytes: e.UPLOAD_MAX_BYTES,
      minLongEdge: e.UPLOAD_MIN_LONG_EDGE,
      minShortEdge: e.UPLOAD_MIN_SHORT_EDGE,
      displayName: profile?.displayName ?? '',
    }
  })
