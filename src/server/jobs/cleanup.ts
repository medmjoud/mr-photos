import { runRetentionCleanup } from '../moderation/service'
import { pruneRateLimits } from '../ratelimit'
import { pruneExpiredSessions } from '../auth/session'

/** Daily maintenance: retention deletes, expired sessions/tokens, stale rate-limit rows. */
export async function runDailyCleanup() {
  const retention = await runRetentionCleanup()
  await pruneExpiredSessions()
  await pruneRateLimits()
  return { deletedPhotos: retention.photos }
}
