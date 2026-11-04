/**
 * Applies pending SQL migrations from ./drizzle. Safe to run on every start.
 *   npm run db:migrate
 */
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'

const url = process.env.DATABASE_URL ?? 'file:.data/soura.db'
if (url.startsWith('file:')) {
  const path = url.slice('file:'.length)
  if (path && path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true })
}
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
await migrate(drizzle(client), { migrationsFolder: resolve(process.cwd(), 'drizzle') })
client.close()
console.info(`[migrate] database up to date (${url.startsWith('file:') ? url : 'remote'})`)
