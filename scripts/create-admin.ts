/**
 * Creates the first admin, or promotes an existing account.
 *
 *   npm run admin:create -- --email you@example.org [--name "Your Name"] [--password "…"]
 *
 * Without --password a strong random password is generated and printed once;
 * change it afterwards with "Forgot password".
 */
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'
import { eq } from 'drizzle-orm'
import { getDb, schema } from '../src/server/db/client'
import { hashPassword } from '../src/server/auth/password'
import { newId } from '../src/server/crypto'
import { uniqueProfileSlug } from '../src/server/profiles'

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' }, password: { type: 'string' } },
})
const email = values.email?.trim().toLowerCase()
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: npm run admin:create -- --email you@example.org [--name "Name"] [--password "…"]')
  process.exit(1)
}

const db = await getDb()
const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).get()
if (existing) {
  await db
    .update(schema.users)
    .set({ role: 'admin', status: 'active', suspendedReason: null, emailVerifiedAt: existing.emailVerifiedAt ?? new Date() })
    .where(eq(schema.users.id, existing.id))
  await db.insert(schema.moderationLog).values({ actorId: null, action: 'promote_admin_cli', targetType: 'user', targetId: existing.id })
  console.info(`✓ ${email} is now an admin.`)
  process.exit(0)
}

const password = values.password ?? randomBytes(15).toString('base64url')
if (password.length < 10) {
  console.error('Password must be at least 10 characters.')
  process.exit(1)
}
const id = newId()
const name = values.name?.trim() || email.split('@')[0]
await db.insert(schema.users).values({
  id,
  email,
  passwordHash: await hashPassword(password),
  role: 'admin',
  emailVerifiedAt: new Date(),
})
await db.insert(schema.profiles).values({ userId: id, slug: await uniqueProfileSlug(name), displayName: name })
await db.insert(schema.moderationLog).values({ actorId: null, action: 'create_admin_cli', targetType: 'user', targetId: id })
console.info(`✓ Admin created: ${email}`)
if (!values.password) console.info(`  Temporary password (shown once): ${password}`)
process.exit(0)
