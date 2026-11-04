/**
 * Starts the production build with an isolated, freshly migrated database
 * for Playwright. Never touches .data/soura.db.
 */
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd(), '.data/e2e')
rmSync(root, { recursive: true, force: true })
const port = process.env.E2E_PORT ?? '3200'
const env = {
  ...process.env,
  NODE_ENV: 'production',
  APP_ENV: 'test',
  PORT: port,
  APP_URL: `http://localhost:${port}`,
  DATABASE_URL: `file:${root}/soura.db`,
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: `${root}/storage`,
  DEV_MAIL_DIR: '.data/e2e/mail',
  SESSION_SECRET: 'e2e-session-secret-0123456789abcdefghijklmnop',
  EMAIL_PROVIDER: 'console',
  MODERATION_PROVIDER: 'mock',
  REPORT_AUTOHIDE_THRESHOLD: '2',
  // Many signups/logins come from one IP during the suite.
  RATE_LIMIT_MULTIPLIER: '20',
  UPLOAD_MIN_LONG_EDGE: '1200',
  UPLOAD_MIN_SHORT_EDGE: '800',
  CRON_SECRET: 'e2e-cron-secret-0123456789',
}

function run(cmd: string, args: Array<string>) {
  return new Promise<void>((res, rej) => {
    const p = spawn(cmd, args, { env, stdio: 'inherit' })
    p.on('exit', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`))))
  })
}

await run('npx', ['tsx', 'scripts/migrate.ts'])
await run('npx', ['tsx', 'scripts/create-admin.ts', '--email', 'admin@e2e.test', '--name', 'Admin E2E', '--password', 'admin-e2e-password'])
const server = spawn('node', ['.output/server/index.mjs'], { env, stdio: 'inherit' })
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => server.kill(sig))
server.on('exit', (code) => process.exit(code ?? 0))
