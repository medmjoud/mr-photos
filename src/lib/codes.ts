/** Moderation codes shared by the database schema, server and UI (isomorphic, no DB imports). */
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
