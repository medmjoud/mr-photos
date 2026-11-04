import { getClient, getDb } from './db/client'
import { env } from './env'

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: number }

/**
 * Fixed-window rate limiter stored in SQLite (atomic upsert). Works across
 * restarts and for a single-instance deployment. Swap for Redis/Durable
 * Objects if the app is scaled horizontally.
 */
export async function consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  await getDb()
  const now = Date.now()
  const resetAt = now + windowSeconds * 1000
  const res = await getClient().execute({
    sql: `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
          ON CONFLICT(key) DO UPDATE SET
            count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
            reset_at = CASE WHEN rate_limits.reset_at <= ? THEN excluded.reset_at ELSE rate_limits.reset_at END
          RETURNING count, reset_at`,
    args: [key, resetAt, now, now],
  })
  const row = res.rows[0]
  const count = Number(row?.count ?? 1)
  const reset = Number(row?.reset_at ?? resetAt)
  const e = env()
  const effective = e.isProduction ? limit : limit * Math.max(1, e.RATE_LIMIT_MULTIPLIER)
  return { ok: count <= effective, remaining: Math.max(0, effective - count), resetAt: reset }
}

/** Consumes several limits; fails if any is exceeded. */
export async function consumeAll(
  rules: Array<{ key: string; limit: number; windowSeconds: number }>,
): Promise<RateLimitResult> {
  let worst: RateLimitResult = { ok: true, remaining: Number.POSITIVE_INFINITY, resetAt: 0 }
  for (const r of rules) {
    const res = await consume(r.key, r.limit, r.windowSeconds)
    if (!res.ok) return res
    if (res.remaining < worst.remaining) worst = res
  }
  return worst
}

export async function pruneRateLimits(): Promise<void> {
  await getDb()
  await getClient().execute({ sql: 'DELETE FROM rate_limits WHERE reset_at <= ?', args: [Date.now()] })
}

export class RateLimitError extends Error {
  constructor(public resetAt: number) {
    super('rate_limited')
  }
}
