import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '@/server/db/client'
import { getSessionUser } from '@/server/auth/session'
import { env } from '@/server/env'

/** Everything the locale layout needs in one round-trip. */
export const getShell = createServerFn({ method: 'GET' }).handler(async () => {
  const e = env()
  const db = await getDb()
  const user = await getSessionUser()
  const profile = user
    ? await db
        .select({ displayName: schema.profiles.displayName, slug: schema.profiles.slug })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, user.id))
        .get()
    : undefined
  const demo = await db
    .select({ id: schema.photos.id })
    .from(schema.photos)
    .where(eq(schema.photos.isDemo, true))
    .limit(1)
    .get()
  return {
    me: user
      ? {
          id: user.id,
          email: user.email,
          role: user.role,
          verified: user.emailVerifiedAt !== null,
          displayName: profile?.displayName ?? '',
          slug: profile?.slug ?? '',
        }
      : null,
    siteUrl: e.APP_URL,
    hasDemo: Boolean(demo),
    analytics: e.ANALYTICS_SCRIPT_URL ? { src: e.ANALYTICS_SCRIPT_URL, domain: e.ANALYTICS_DOMAIN ?? '' } : null,
  }
})
