import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import { deleteCookie, getCookie, getRequest, setCookie } from '@tanstack/react-start/server'
import { getDb, schema } from '../db/client'
import { env } from '../env'
import { randomToken, sha256Hex } from '../crypto'
import type { Actor } from '@/lib/permissions'
import type { TokenPurpose, User } from '../db/schema'

const DAY = 86_400_000
const SESSION_TTL = 30 * DAY
const RENEW_WHEN_LESS_THAN = 15 * DAY

export function sessionCookieName(): string {
  // __Host- binds the cookie to this exact origin (requires Secure + Path=/).
  return env().secureCookies ? '__Host-soura_session' : 'soura_session'
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env().secureCookies,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

export type SessionUser = Pick<User, 'id' | 'email' | 'role' | 'status' | 'emailVerifiedAt' | 'locale'>

export function toActor(user: SessionUser | null): Actor {
  if (!user) return null
  return {
    id: user.id,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
  }
}

/** Creates a session and sets the cookie. Callers should revoke old sessions first on privilege change. */
export async function createSession(userId: string): Promise<void> {
  const db = await getDb()
  const token = randomToken(32)
  await db.insert(schema.sessions).values({
    id: sha256Hex(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL),
  })
  setCookie(sessionCookieName(), token, cookieOptions(SESSION_TTL / 1000))
}

export async function revokeAllSessions(userId: string): Promise<void> {
  const db = await getDb()
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId))
}

export async function destroyCurrentSession(): Promise<void> {
  const token = getCookie(sessionCookieName())
  if (token) {
    const db = await getDb()
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256Hex(token)))
  }
  deleteCookie(sessionCookieName(), cookieOptions(0))
}

export async function validateSessionToken(token: string): Promise<{ user: SessionUser; renewed: boolean } | null> {
  if (!token || token.length > 100) return null
  const db = await getDb()
  const id = sha256Hex(token)
  const row = await db
    .select({
      sessionId: schema.sessions.id,
      expiresAt: schema.sessions.expiresAt,
      id: schema.users.id,
      email: schema.users.email,
      role: schema.users.role,
      status: schema.users.status,
      emailVerifiedAt: schema.users.emailVerifiedAt,
      locale: schema.users.locale,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.id, id))
    .get()
  if (!row) return null
  const now = Date.now()
  if (row.expiresAt.getTime() <= now) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, id))
    return null
  }
  if (row.status !== 'active') {
    // Suspended accounts lose every session immediately.
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, row.id))
    return null
  }
  let renewed = false
  if (row.expiresAt.getTime() - now < RENEW_WHEN_LESS_THAN) {
    await db
      .update(schema.sessions)
      .set({ expiresAt: new Date(now + SESSION_TTL) })
      .where(eq(schema.sessions.id, id))
    renewed = true
  }
  const { sessionId: _s, expiresAt: _e, ...user } = row
  return { user, renewed }
}

const perRequest = new WeakMap<Request, Promise<SessionUser | null>>()

/** Current user for this request (memoised per request). */
export function getSessionUser(): Promise<SessionUser | null> {
  const request = getRequest()
  const existing = perRequest.get(request)
  if (existing) return existing
  const p = (async () => {
    const token = getCookie(sessionCookieName())
    if (!token) return null
    const result = await validateSessionToken(token)
    if (!result) {
      deleteCookie(sessionCookieName(), cookieOptions(0))
      return null
    }
    if (result.renewed) setCookie(sessionCookieName(), token, cookieOptions(SESSION_TTL / 1000))
    return result.user
  })()
  perRequest.set(request, p)
  return p
}

export async function pruneExpiredSessions(): Promise<void> {
  const db = await getDb()
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()))
  await db.delete(schema.authTokens).where(lt(schema.authTokens.expiresAt, new Date(Date.now() - DAY)))
}

/* ------------------------------------------------------- one-time tokens */

const TOKEN_TTL: Record<TokenPurpose, number> = {
  verify_email: 2 * DAY,
  reset_password: 60 * 60 * 1000,
}

export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const db = await getDb()
  // One live token per purpose.
  await db
    .delete(schema.authTokens)
    .where(and(eq(schema.authTokens.userId, userId), eq(schema.authTokens.purpose, purpose)))
  const token = randomToken(32)
  await db.insert(schema.authTokens).values({
    id: sha256Hex(token),
    userId,
    purpose,
    expiresAt: new Date(Date.now() + TOKEN_TTL[purpose]),
  })
  return token
}

/** Atomically marks a token used. Returns the user id, or null if invalid/expired/used. */
export async function consumeToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  if (!token || token.length > 100) return null
  const db = await getDb()
  const rows = await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.authTokens.id, sha256Hex(token)),
        eq(schema.authTokens.purpose, purpose),
        isNull(schema.authTokens.usedAt),
        gt(schema.authTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: schema.authTokens.userId })
  return rows[0]?.userId ?? null
}
