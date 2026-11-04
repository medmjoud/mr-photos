import { getDb, schema } from '../db/client'
import type { JsonValue } from '../db/schema'

export type LogEntry = {
  actorId: string | null
  action: string
  targetType: 'photo' | 'user' | 'report' | 'avatar' | 'system'
  targetId: string
  details?: Record<string, JsonValue>
}

/** Append-only moderation log. Every moderation action and automatic decision goes through here. */
export async function logAction(entry: LogEntry): Promise<void> {
  const db = await getDb()
  await db.insert(schema.moderationLog).values({
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    details: entry.details ?? null,
  })
}
