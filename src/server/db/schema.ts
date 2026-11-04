/**
 * SOURA database schema (SQLite dialect — runs on libSQL/Turso locally and in
 * production, and is compatible with Cloudflare D1 if the app is ever moved).
 *
 * Conventions:
 *  - ids are 16-char lowercase alphanumeric strings (see server/ids.ts)
 *  - timestamps are integer milliseconds (`mode: 'timestamp_ms'`)
 *  - enums are stored as text and validated in code
 */
import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

const now = sql`(cast(unixepoch('subsec') * 1000 as integer))`

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(now)
    .$onUpdate(() => new Date()),
}

/* ------------------------------------------------------------------ users */

export const USER_ROLES = ['photographer', 'admin'] as const
export type UserRole = (typeof USER_ROLES)[number]
export const USER_STATUSES = ['active', 'suspended'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: USER_ROLES }).notNull().default('photographer'),
  status: text('status', { enum: USER_STATUSES }).notNull().default('active'),
  suspendedReason: text('suspended_reason'),
  suspendedAt: integer('suspended_at', { mode: 'timestamp_ms' }),
  emailVerifiedAt: integer('email_verified_at', { mode: 'timestamp_ms' }),
  locale: text('locale').notNull().default('fr'),
  isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
  ...timestamps,
})

export const sessions = sqliteTable(
  'sessions',
  {
    /** sha256(token) — the raw token only ever lives in the cookie. */
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

export const TOKEN_PURPOSES = ['verify_email', 'reset_password'] as const
export type TokenPurpose = (typeof TOKEN_PURPOSES)[number]

export const authTokens = sqliteTable(
  'auth_tokens',
  {
    /** sha256(token) */
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text('purpose', { enum: TOKEN_PURPOSES }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
  },
  (t) => [index('auth_tokens_user_idx').on(t.userId, t.purpose)],
)

/* --------------------------------------------------------------- profiles */

export const AVATAR_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const
export type AvatarStatus = (typeof AVATAR_STATUSES)[number]

export const profiles = sqliteTable(
  'profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull().unique(),
    displayName: text('display_name').notNull(),
    bio: text('bio').notNull().default(''),
    regionSlug: text('region_slug'),
    city: text('city').notNull().default(''),
    website: text('website').notNull().default(''),
    instagram: text('instagram').notNull().default(''),
    /** Contact details — never rendered into HTML; revealed via /api/contact. */
    whatsapp: text('whatsapp').notNull().default(''),
    contactEmail: text('contact_email').notNull().default(''),
    showWhatsapp: integer('show_whatsapp', { mode: 'boolean' }).notNull().default(false),
    showEmail: integer('show_email', { mode: 'boolean' }).notNull().default(false),
    avatarStatus: text('avatar_status', { enum: AVATAR_STATUSES }).notNull().default('none'),
    /** JSON: { key, token, blur } of the processed avatar (private storage). */
    avatar: text('avatar', { mode: 'json' }).$type<AvatarRecord | null>(),
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => [index('profiles_featured_idx').on(t.featured)],
)

export type AvatarRecord = {
  token: string
  blur: string
  /** Storage keys for 160px and 480px square WebP avatars. */
  keys: { s160: string; s480: string }
}

/* ----------------------------------------------------------------- photos */

export const PHOTO_STATUSES = ['pending', 'approved', 'rejected', 'removed'] as const
export type PhotoStatus = (typeof PHOTO_STATUSES)[number]

export const PROCESSING_STATES = ['queued', 'processing', 'ready', 'failed'] as const
export type ProcessingState = (typeof PROCESSING_STATES)[number]

export const AI_STATUSES = [
  'not_run', // job has not reached the AI step yet
  'skipped', // deliberately not sent (e.g. CSAM lock)
  'unavailable', // no provider configured / provider down
  'error', // provider returned an error
  'clear', // provider found nothing — still requires human approval
  'flagged', // provider flagged one or more categories
] as const
export type AiStatus = (typeof AI_STATUSES)[number]

export const HIDDEN_REASONS = ['reports', 'urgent_report', 'admin', 'csam'] as const
export type HiddenReason = (typeof HIDDEN_REASONS)[number]

export const REJECTION_REASONS = [
  'nudity_sexual',
  'graphic_violence',
  'hate',
  'humiliating',
  'stolen',
  'consent',
  'not_mauritania',
  'low_quality',
  'screenshot',
  'heavy_filter',
  'watermark',
  'duplicate',
  'other',
] as const
export type RejectionReason = (typeof REJECTION_REASONS)[number]

export type PhotoVariant = {
  kind: 'thumb' | 'preview' | 'og' | 'review'
  width: number
  height: number
  format: 'avif' | 'webp' | 'jpeg'
  key: string
  bytes: number
}

export type AiFlag = { category: AiCategory; score: number }
export const AI_CATEGORIES = ['nudity', 'sexual', 'sexual_minors', 'graphic_violence', 'hate', 'self_harm'] as const
export type AiCategory = (typeof AI_CATEGORIES)[number]

export const photos = sqliteTable(
  'photos',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    tags: text('tags', { mode: 'json' }).$type<Array<string>>().notNull().default(sql`'[]'`),
    regionSlug: text('region_slug').notNull(),
    locationText: text('location_text').notNull().default(''),
    category: text('category').notNull(),
    authorName: text('author_name').notNull(),
    yearTaken: integer('year_taken').notNull(),

    // uploader declarations
    hasPeople: integer('has_people', { mode: 'boolean' }).notNull(),
    hasMinor: integer('has_minor', { mode: 'boolean' }).notNull(),
    confirmedRights: integer('confirmed_rights', { mode: 'boolean' }).notNull(),
    confirmedConsent: integer('confirmed_consent', { mode: 'boolean' }).notNull(),
    confirmedRules: integer('confirmed_rules', { mode: 'boolean' }).notNull(),

    // moderation
    status: text('status', { enum: PHOTO_STATUSES }).notNull().default('pending'),
    hiddenAt: integer('hidden_at', { mode: 'timestamp_ms' }),
    hiddenReason: text('hidden_reason', { enum: HIDDEN_REASONS }),
    csamLockedAt: integer('csam_locked_at', { mode: 'timestamp_ms' }),
    csamLockedBy: text('csam_locked_by'),
    legalHold: integer('legal_hold', { mode: 'boolean' }).notNull().default(false),
    rejectionReason: text('rejection_reason', { enum: REJECTION_REASONS }),
    rejectionNote: text('rejection_note'),
    rejectedAt: integer('rejected_at', { mode: 'timestamp_ms' }),
    deleteAfter: integer('delete_after', { mode: 'timestamp_ms' }),
    approvedAt: integer('approved_at', { mode: 'timestamp_ms' }),
    approvedBy: text('approved_by'),
    altFr: text('alt_fr').notNull().default(''),
    altAr: text('alt_ar').notNull().default(''),
    altEn: text('alt_en').notNull().default(''),

    // AI pre-screening (advisory only)
    aiStatus: text('ai_status', { enum: AI_STATUSES }).notNull().default('not_run'),
    aiProvider: text('ai_provider'),
    aiFlags: text('ai_flags', { mode: 'json' }).$type<Array<AiFlag>>(),
    aiCheckedAt: integer('ai_checked_at', { mode: 'timestamp_ms' }),
    aiError: text('ai_error'),

    // processing pipeline
    processing: text('processing', { enum: PROCESSING_STATES }).notNull().default('queued'),
    processingError: text('processing_error'),
    processingAttempts: integer('processing_attempts').notNull().default(0),
    processingStartedAt: integer('processing_started_at', { mode: 'timestamp_ms' }),

    // file data
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    orientation: text('orientation', { enum: ['landscape', 'portrait', 'square'] }).notNull(),
    originalKey: text('original_key').notNull(),
    originalMime: text('original_mime').notNull(),
    originalBytes: integer('original_bytes').notNull(),
    originalSha256: text('original_sha256').notNull(),
    /** Random token in public media URLs; rotated whenever the photo is hidden. */
    publicToken: text('public_token').notNull(),
    blurDataUrl: text('blur_data_url'),
    variants: text('variants', { mode: 'json' }).$type<Array<PhotoVariant>>().notNull().default(sql`'[]'`),

    // discovery
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    searchText: text('search_text').notNull().default(''),
    viewCount: integer('view_count').notNull().default(0),
    contactCount: integer('contact_count').notNull().default(0),
    isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('photos_status_idx').on(t.status, t.approvedAt),
    index('photos_owner_idx').on(t.ownerId, t.createdAt),
    index('photos_region_idx').on(t.regionSlug),
    index('photos_category_idx').on(t.category),
    index('photos_sha_idx').on(t.originalSha256),
    index('photos_processing_idx').on(t.processing),
  ],
)

/* ---------------------------------------------------------------- reports */

export const REPORT_REASONS = [
  'csam',
  'nudity_sexual',
  'graphic_violence',
  'hate',
  'humiliating',
  'stolen',
  'privacy',
  'not_mauritania',
  'other',
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]
export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const
export const REPORT_SOURCES = ['button', 'takedown_form'] as const

export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    photoId: text('photo_id').references(() => photos.id, { onDelete: 'set null' }),
    source: text('source', { enum: REPORT_SOURCES }).notNull().default('button'),
    reason: text('reason', { enum: REPORT_REASONS }).notNull(),
    details: text('details').notNull().default(''),
    /** Takedown form only: who is asking (optional for button reports). */
    reporterName: text('reporter_name').notNull().default(''),
    reporterEmail: text('reporter_email').notNull().default(''),
    photoUrl: text('photo_url').notNull().default(''),
    /** Daily-salted hash of IP+UA; used only to count distinct reporters. */
    reporterHash: text('reporter_hash').notNull(),
    status: text('status', { enum: REPORT_STATUSES }).notNull().default('open'),
    resolution: text('resolution'),
    resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
    resolvedBy: text('resolved_by'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
  },
  (t) => [index('reports_photo_idx').on(t.photoId, t.status), index('reports_status_idx').on(t.status, t.createdAt)],
)

/* -------------------------------------------------------- moderation log */

export const moderationLog = sqliteTable(
  'moderation_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** null = system (pipeline, auto-hide, retention job). */
    actorId: text('actor_id'),
    action: text('action').notNull(),
    targetType: text('target_type', { enum: ['photo', 'user', 'report', 'avatar', 'system'] }).notNull(),
    targetId: text('target_id').notNull(),
    details: text('details', { mode: 'json' }).$type<Record<string, unknown>>(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
  },
  (t) => [index('modlog_target_idx').on(t.targetType, t.targetId), index('modlog_created_idx').on(t.createdAt)],
)

/* ------------------------------------------------------------ rate limits */

export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: integer('reset_at').notNull(),
})

/* -------------------------------------------------------------- analytics */

export const ANALYTICS_TYPES = ['photo_view', 'profile_view', 'contact_whatsapp', 'contact_email'] as const
export type AnalyticsType = (typeof ANALYTICS_TYPES)[number]

/** Daily random salts; deleted after two days so visitor hashes cannot be linked across days. */
export const analyticsSalts = sqliteTable('analytics_salts', {
  day: text('day').primaryKey(),
  salt: text('salt').notNull(),
})

export const analyticsEvents = sqliteTable(
  'analytics_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    type: text('type', { enum: ANALYTICS_TYPES }).notNull(),
    /** Photo id for photo events, photographer user id for profile/contact events without a photo. */
    subjectId: text('subject_id').notNull(),
    photographerId: text('photographer_id').notNull(),
    day: text('day').notNull(),
    visitorHash: text('visitor_hash').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(now),
  },
  (t) => [
    uniqueIndex('analytics_dedupe_idx').on(t.type, t.subjectId, t.day, t.visitorHash),
    index('analytics_photographer_idx').on(t.photographerId, t.type),
  ],
)

export type User = typeof users.$inferSelect
export type Profile = typeof profiles.$inferSelect
export type Photo = typeof photos.$inferSelect
export type Report = typeof reports.$inferSelect
