import { eq, sql } from 'drizzle-orm'
import { getDb, schema } from './db/client'
import { isBot, utcDay, visitorHash } from './request'
import type { AnalyticsType } from './db/schema'

/**
 * First-party, cookieless counting. One event per (type, subject, visitor,
 * day); the visitor hash uses a random daily salt that is deleted after two
 * days, so no persistent identifier is ever stored.
 */
export async function recordEvent(input: {
  type: AnalyticsType
  subjectId: string
  photographerId: string
  ip: string
  userAgent: string
}): Promise<boolean> {
  if (isBot(input.userAgent)) return false
  const db = await getDb()
  const day = utcDay()
  const hash = await visitorHash(input.ip, input.userAgent, day)
  const res = await db
    .insert(schema.analyticsEvents)
    .values({ type: input.type, subjectId: input.subjectId, photographerId: input.photographerId, day, visitorHash: hash })
    .onConflictDoNothing()
    .returning({ id: schema.analyticsEvents.id })
  const inserted = res.length > 0
  if (inserted && input.subjectId !== input.photographerId) {
    if (input.type === 'photo_view') {
      await db
        .update(schema.photos)
        .set({ viewCount: sql`${schema.photos.viewCount} + 1` })
        .where(eq(schema.photos.id, input.subjectId))
    } else if (input.type === 'contact_whatsapp' || input.type === 'contact_email') {
      await db
        .update(schema.photos)
        .set({ contactCount: sql`${schema.photos.contactCount} + 1` })
        .where(eq(schema.photos.id, input.subjectId))
    }
  }
  return inserted
}
