import { eq } from 'drizzle-orm'
import { getDb, schema } from './db/client'
import { newId } from './crypto'
import { slugify } from '@/lib/text'

const RESERVED = new Set(['new', 'edit', 'admin', 'me', 'settings', 'demo'])

/** Unique, URL-safe profile slug derived from a display name. */
export async function uniqueProfileSlug(displayName: string): Promise<string> {
  const db = await getDb()
  const base = slugify(displayName, 'photographe').slice(0, 40)
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 && !RESERVED.has(base) ? base : `${base}-${newId(4)}`
    const taken = await db
      .select({ id: schema.profiles.userId })
      .from(schema.profiles)
      .where(eq(schema.profiles.slug, candidate))
      .get()
    if (!taken) return candidate
  }
  return `${base}-${newId(8)}`
}
