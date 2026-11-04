import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import { env } from '../env'
import * as schema from './schema'

export type DB = LibSQLDatabase<typeof schema>

type Holder = { client: Client; db: DB; ready: Promise<void> }

const g = globalThis as unknown as { __souraDb?: Holder }

function open(): Holder {
  const { DATABASE_URL, DATABASE_AUTH_TOKEN } = env()
  if (DATABASE_URL.startsWith('file:')) {
    const path = DATABASE_URL.slice('file:'.length)
    if (path && path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  }
  const client = createClient({ url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN })
  const db = drizzle(client, { schema })
  const ready = DATABASE_URL.startsWith('file:')
    ? client
        .executeMultiple(
          'PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;',
        )
        .then(() => undefined)
    : Promise.resolve()
  return { client, db, ready }
}

function holder(): Holder {
  g.__souraDb ??= open()
  return g.__souraDb
}

/** Drizzle instance. Await `dbReady()` once per request path before heavy use (cheap after first). */
export async function getDb(): Promise<DB> {
  const h = holder()
  await h.ready
  return h.db
}

export function getClient(): Client {
  return holder().client
}

export { schema }
