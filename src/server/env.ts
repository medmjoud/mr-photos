import { z } from 'zod'

/**
 * Server configuration. Read lazily (never at module scope) so values are
 * resolved at request time and never inlined into a client bundle.
 */
const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1')

const int = (def: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? Number.parseInt(v, 10) : def))
    .pipe(z.number().int().nonnegative())

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** "production" enables strict checks; "staging" behaves like production for safety. */
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).optional(),
  APP_URL: z.url().default('http://localhost:3000'),

  DATABASE_URL: z.string().default('file:.data/soura.db'),
  DATABASE_AUTH_TOKEN: z.string().optional(),

  /** 32+ random bytes. Used for signed URLs and privacy-preserving hashes. */
  SESSION_SECRET: z.string().optional(),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('.data/storage'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  EMAIL_FROM: z.string().default('SOURA <no-reply@localhost>'),
  RESEND_API_KEY: z.string().optional(),
  /** Where the console email provider writes messages (development/tests). */
  DEV_MAIL_DIR: z.string().default('.data/mail'),
  /** Where urgent moderation alerts (urgent reports) are sent. Optional. */
  MODERATION_ALERT_EMAIL: z.string().optional(),

  MODERATION_PROVIDER: z.enum(['none', 'mock', 'openai']).default('none'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODERATION_MODEL: z.string().default('omni-moderation-latest'),
  MODERATION_TIMEOUT_MS: int(20_000),

  UPLOAD_MAX_BYTES: int(30 * 1024 * 1024),
  UPLOAD_MIN_LONG_EDGE: int(2000),
  UPLOAD_MIN_SHORT_EDGE: int(1000),
  UPLOAD_MAX_PIXELS: int(120_000_000),
  UPLOADS_PER_HOUR: int(10),
  UPLOADS_PER_DAY: int(30),
  MAX_PENDING_PER_USER: int(40),
  PREVIEW_LONG_EDGE: int(1600),

  REPORT_AUTOHIDE_THRESHOLD: int(3),
  REJECTED_RETENTION_DAYS: int(7),

  /** How to read the client IP: "none" (socket), "cloudflare" (CF-Connecting-IP), "xff" (first X-Forwarded-For). */
  TRUST_PROXY: z.enum(['none', 'cloudflare', 'xff']).default('none'),
  CRON_SECRET: z.string().optional(),

  /** Optional cookieless analytics script (e.g. Plausible, Umami). */
  ANALYTICS_SCRIPT_URL: z.string().optional(),
  ANALYTICS_DOMAIN: z.string().optional(),

  /** Optional: purge Cloudflare cache for media URLs when a photo is hidden. */
  CLOUDFLARE_ZONE_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),

  ALLOW_DEMO_SEED: bool,
})

export type Env = z.infer<typeof schema> & {
  /** APP_ENV production/staging: strict configuration checks, demo seeding forbidden. */
  isProduction: boolean
  /** APP_URL is https: Secure + __Host- cookies, HSTS. */
  secureCookies: boolean
  sessionSecret: string
  appOrigin: string
}

let cached: Env | null = null

export function env(): Env {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${z.prettifyError(parsed.error)}`)
  }
  const e = parsed.data
  const appEnv = e.APP_ENV ?? (e.NODE_ENV === 'production' ? 'production' : e.NODE_ENV)
  const isProduction = appEnv === 'production' || appEnv === 'staging'

  let sessionSecret = e.SESSION_SECRET ?? ''
  if (sessionSecret.length < 32) {
    if (isProduction) {
      throw new Error('SESSION_SECRET must be set to at least 32 characters in production.')
    }
    sessionSecret = 'dev-only-insecure-secret-change-me-0123456789'
  }
  if (isProduction && e.STORAGE_DRIVER === 's3') {
    for (const k of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const) {
      if (!e[k]) throw new Error(`${k} is required when STORAGE_DRIVER=s3`)
    }
  }
  if (e.EMAIL_PROVIDER === 'resend' && !e.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend')
  }

  cached = {
    ...e,
    APP_ENV: appEnv,
    isProduction,
    secureCookies: new URL(e.APP_URL).protocol === 'https:',
    sessionSecret,
    appOrigin: new URL(e.APP_URL).origin,
  }
  return cached
}

/** Test helper: forget the cached environment. */
export function resetEnvCache() {
  cached = null
}
