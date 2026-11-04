import { eq, lt } from 'drizzle-orm'
import { getRequest, getRequestIP } from '@tanstack/react-start/server'
import { getDb, schema } from './db/client'
import { env } from './env'
import { randomToken, sha256Hex } from './crypto'

/** Resolves the client IP according to TRUST_PROXY. Never trust XFF unless configured. */
export function clientIp(request: Request, socketIp?: string | null): string {
  const mode = env().TRUST_PROXY
  if (mode === 'cloudflare') {
    const ip = request.headers.get('cf-connecting-ip')
    if (ip) return ip.trim()
  }
  if (mode === 'xff') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]
    if (ip) return ip.trim()
  }
  return socketIp ?? 'unknown'
}

/** Client IP of the current request (inside a server function / route handler). */
export function requestIp(): string {
  return clientIp(getRequest(), getRequestIP() ?? null)
}

export function requestUserAgent(): string {
  return (getRequest().headers.get('user-agent') ?? '').slice(0, 300)
}

export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Privacy-friendly visitor hash (Plausible-style): sha256(dailySalt + ip + ua).
 * Salts are random, stored per day and deleted after two days, so the hash
 * cannot be linked across days or reversed to an IP.
 */
export async function visitorHash(ip: string, userAgent: string, day = utcDay()): Promise<string> {
  const db = await getDb()
  let salt = (await db.select().from(schema.analyticsSalts).where(eq(schema.analyticsSalts.day, day)).get())?.salt
  if (!salt) {
    const fresh = randomToken(24)
    await db.insert(schema.analyticsSalts).values({ day, salt: fresh }).onConflictDoNothing()
    salt = (await db.select().from(schema.analyticsSalts).where(eq(schema.analyticsSalts.day, day)).get())?.salt ?? fresh
    const cutoff = utcDay(new Date(Date.now() - 2 * 86_400_000))
    await db.delete(schema.analyticsSalts).where(lt(schema.analyticsSalts.day, cutoff))
  }
  return sha256Hex(`${salt}|${ip}|${userAgent}`).slice(0, 32)
}

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|monitor/i

export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT_UA.test(userAgent)
}
