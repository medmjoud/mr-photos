import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '@/server/db/client'
import { newId } from '@/server/crypto'
import { dummyHash, hashPassword, PASSWORD_MAX, verifyPassword } from '@/server/auth/password'
import {
  consumeToken,
  createSession,
  destroyCurrentSession,
  getSessionUser,
  issueToken,
  revokeAllSessions,
} from '@/server/auth/session'
import { fail } from '@/server/http'
import { zEmail as email, zLocale as locale, zPassword as password } from '@/server/validation'
import { consumeAll } from '@/server/ratelimit'
import { requestIp } from '@/server/request'
import { sendExistingAccountEmail, sendResetEmail, sendVerificationEmail } from '@/server/email'
import { uniqueProfileSlug } from '@/server/profiles'
import { cleanLine } from '@/lib/text'


async function limit(rules: Array<{ key: string; limit: number; windowSeconds: number }>) {
  const res = await consumeAll(rules)
  if (!res.ok) fail('rate_limited', 429)
}

/* ---------------------------------------------------------------- me */

export const getMe = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getSessionUser()
  if (!user) return { user: null }
  const db = await getDb()
  const profile = await db
    .select({ displayName: schema.profiles.displayName, slug: schema.profiles.slug })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, user.id))
    .get()
  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      verified: user.emailVerifiedAt !== null,
      displayName: profile?.displayName ?? '',
      slug: profile?.slug ?? '',
    },
  }
})

/* ------------------------------------------------------------- signup */

export const signup = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      email,
      password,
      displayName: z.string().transform(cleanLine).pipe(z.string().min(2).max(60)),
      locale,
      acceptTerms: z.literal(true),
    }),
  )
  .handler(async ({ data }) => {
    const ip = requestIp()
    await limit([
      { key: `signup:ip:${ip}`, limit: 5, windowSeconds: 3600 },
      { key: `signup:email:${data.email}`, limit: 3, windowSeconds: 3600 },
    ])
    const db = await getDb()
    // Hash in every branch so response time does not reveal existing accounts.
    const passwordHash = await hashPassword(data.password)
    const existing = await db.select().from(schema.users).where(eq(schema.users.email, data.email)).get()
    if (existing) {
      if (existing.emailVerifiedAt) {
        await sendExistingAccountEmail(existing.email, existing.locale)
      } else {
        const token = await issueToken(existing.id, 'verify_email')
        const profile = await db
          .select({ displayName: schema.profiles.displayName })
          .from(schema.profiles)
          .where(eq(schema.profiles.userId, existing.id))
          .get()
        await sendVerificationEmail(existing.email, profile?.displayName ?? '', existing.locale, token)
      }
      return { ok: true as const }
    }
    const id = newId()
    const slug = await uniqueProfileSlug(data.displayName)
    await db.batch([
      db.insert(schema.users).values({ id, email: data.email, passwordHash, locale: data.locale }),
      db.insert(schema.profiles).values({ userId: id, slug, displayName: data.displayName }),
    ])
    const token = await issueToken(id, 'verify_email')
    await sendVerificationEmail(data.email, data.displayName, data.locale, token)
    return { ok: true as const }
  })

/* -------------------------------------------------------------- login */

export const login = createServerFn({ method: 'POST' })
  .validator(z.object({ email, password: z.string().min(1).max(PASSWORD_MAX) }))
  .handler(async ({ data }) => {
    const ip = requestIp()
    await limit([
      { key: `login:ip:${ip}`, limit: 20, windowSeconds: 900 },
      { key: `login:email:${data.email}`, limit: 8, windowSeconds: 900 },
    ])
    const db = await getDb()
    const user = await db.select().from(schema.users).where(eq(schema.users.email, data.email)).get()
    const matches = await verifyPassword(user?.passwordHash ?? (await dummyHash()), data.password)
    if (!user || !matches) fail('invalid_credentials', 401)
    if (user.status !== 'active') fail('account_suspended', 403)
    if (!user.emailVerifiedAt) fail('email_unverified', 403)
    // Session rotation: drop whatever session this browser had, then issue a new one.
    await destroyCurrentSession()
    await createSession(user.id)
    return { ok: true as const, role: user.role }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await destroyCurrentSession()
  return { ok: true as const }
})

/* --------------------------------------------------------- verification */

export const verifyEmail = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string().min(10).max(100) }))
  .handler(async ({ data }) => {
    const ip = requestIp()
    await limit([{ key: `verify:ip:${ip}`, limit: 20, windowSeconds: 900 }])
    const userId = await consumeToken(data.token, 'verify_email')
    if (!userId) fail('token_invalid', 400)
    const db = await getDb()
    const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get()
    if (!user || user.status !== 'active') fail('account_suspended', 403)
    await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, userId))
    await destroyCurrentSession()
    await createSession(userId)
    return { ok: true as const }
  })

export const resendVerification = createServerFn({ method: 'POST' })
  .validator(z.object({ email }))
  .handler(async ({ data }) => {
    const ip = requestIp()
    await limit([
      { key: `resend:ip:${ip}`, limit: 5, windowSeconds: 3600 },
      { key: `resend:email:${data.email}`, limit: 3, windowSeconds: 3600 },
    ])
    const db = await getDb()
    const user = await db.select().from(schema.users).where(eq(schema.users.email, data.email)).get()
    if (user && !user.emailVerifiedAt && user.status === 'active') {
      const profile = await db
        .select({ displayName: schema.profiles.displayName })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, user.id))
        .get()
      const token = await issueToken(user.id, 'verify_email')
      await sendVerificationEmail(user.email, profile?.displayName ?? '', user.locale, token)
    }
    return { ok: true as const }
  })

/* ------------------------------------------------------- password reset */

export const requestPasswordReset = createServerFn({ method: 'POST' })
  .validator(z.object({ email }))
  .handler(async ({ data }) => {
    const ip = requestIp()
    await limit([
      { key: `reset:ip:${ip}`, limit: 5, windowSeconds: 3600 },
      { key: `reset:email:${data.email}`, limit: 3, windowSeconds: 3600 },
    ])
    const db = await getDb()
    const user = await db.select().from(schema.users).where(eq(schema.users.email, data.email)).get()
    if (user && user.status === 'active') {
      const token = await issueToken(user.id, 'reset_password')
      await sendResetEmail(user.email, user.locale, token)
    } else {
      await dummyHash() // similar work in both branches
    }
    return { ok: true as const }
  })

export const resetPassword = createServerFn({ method: 'POST' })
  .validator(z.object({ token: z.string().min(10).max(100), password }))
  .handler(async ({ data }) => {
    const ip = requestIp()
    await limit([{ key: `resetpw:ip:${ip}`, limit: 10, windowSeconds: 3600 }])
    const userId = await consumeToken(data.token, 'reset_password')
    if (!userId) fail('token_invalid', 400)
    const db = await getDb()
    const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get()
    if (!user || user.status !== 'active') fail('account_suspended', 403)
    await db
      .update(schema.users)
      .set({
        passwordHash: await hashPassword(data.password),
        // A working reset link proves control of the inbox.
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      })
      .where(eq(schema.users.id, userId))
    await revokeAllSessions(userId)
    await createSession(userId)
    return { ok: true as const }
  })
