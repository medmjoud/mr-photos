/**
 * Pure moderation rules. No I/O — unit-tested in tests/unit/moderation.test.ts.
 * The database service (server/moderation/service.ts) applies these.
 */

export type PhotoStatus = 'pending' | 'approved' | 'rejected' | 'removed'
export type ProcessingState = 'queued' | 'processing' | 'ready' | 'failed'
export type AiStatus = 'not_run' | 'skipped' | 'unavailable' | 'error' | 'clear' | 'flagged'

export type ModerationFacts = {
  status: PhotoStatus
  processing: ProcessingState
  hiddenAt: Date | number | null
  csamLockedAt: Date | number | null
  altFr: string
  ownerStatus: 'active' | 'suspended'
}

/** The single definition of "publicly visible". Used by every public query and the media route. */
export function isPubliclyVisible(p: ModerationFacts): boolean {
  return (
    p.status === 'approved' &&
    p.processing === 'ready' &&
    p.hiddenAt === null &&
    p.csamLockedAt === null &&
    p.ownerStatus === 'active'
  )
}

export type ModerationAction = 'approve' | 'reject' | 'remove' | 'restore' | 'hide'

/** Allowed status transitions for human moderation actions. */
const TRANSITIONS: Record<ModerationAction, ReadonlyArray<PhotoStatus>> = {
  approve: ['pending'],
  reject: ['pending'],
  remove: ['approved', 'pending'],
  hide: ['approved'],
  restore: ['approved'], // un-hide an approved photo after review
}

export function canTransition(action: ModerationAction, from: PhotoStatus): boolean {
  return TRANSITIONS[action].includes(from)
}

export const ALT_MIN = 8
export const ALT_MAX = 300

export type ApprovalBlocker = 'not_pending' | 'processing_not_ready' | 'csam_locked' | 'alt_missing' | 'owner_suspended'

/** Reasons a photo cannot be approved right now (empty = approvable). */
export function approvalBlockers(p: ModerationFacts, altFr: string): Array<ApprovalBlocker> {
  const out: Array<ApprovalBlocker> = []
  if (p.status !== 'pending') out.push('not_pending')
  if (p.processing !== 'ready') out.push('processing_not_ready')
  if (p.csamLockedAt) out.push('csam_locked')
  if (altFr.trim().length < ALT_MIN) out.push('alt_missing')
  if (p.ownerStatus !== 'active') out.push('owner_suspended')
  return out
}

/* ------------------------------------------------------------- reports */

export const URGENT_REPORT_REASONS = ['csam'] as const

export function isUrgentReason(reason: string): boolean {
  return (URGENT_REPORT_REASONS as ReadonlyArray<string>).includes(reason)
}

/**
 * Auto-hide decision for an approved photo after a new report.
 * - an urgent (child-abuse) report hides immediately;
 * - otherwise, `threshold` distinct reporters with open reports hide it.
 */
export function autoHideDecision(input: {
  newReason: string
  distinctOpenReporters: number
  threshold: number
  alreadyHidden: boolean
}): { hide: boolean; reason: 'urgent_report' | 'reports' | null } {
  if (input.alreadyHidden) return { hide: false, reason: null }
  if (isUrgentReason(input.newReason)) return { hide: true, reason: 'urgent_report' }
  if (input.threshold > 0 && input.distinctOpenReporters >= input.threshold) return { hide: true, reason: 'reports' }
  return { hide: false, reason: null }
}

/* ------------------------------------------------------------------ AI */

export type AiCategory = 'nudity' | 'sexual' | 'sexual_minors' | 'graphic_violence' | 'hate' | 'self_harm'
export type AiFlag = { category: AiCategory; score: number }
export type AiOutcome =
  | { kind: 'result'; flags: Array<AiFlag>; provider: string }
  | { kind: 'unavailable'; provider: string }
  | { kind: 'error'; provider: string; message: string }
  | { kind: 'skipped'; provider: string }

/**
 * Converts an AI outcome into a database patch. By construction this patch
 * contains AI fields only — it can never change `status`, so the AI can
 * never approve (or reject) a photo.
 */
export function aiPatch(outcome: AiOutcome, now = new Date()) {
  const base = { aiProvider: outcome.provider, aiCheckedAt: now }
  switch (outcome.kind) {
    case 'result':
      return {
        ...base,
        aiStatus: (outcome.flags.length > 0 ? 'flagged' : 'clear') as AiStatus,
        aiFlags: outcome.flags,
        aiError: null,
      }
    case 'unavailable':
      return { ...base, aiStatus: 'unavailable' as AiStatus, aiFlags: null, aiError: null }
    case 'skipped':
      return { ...base, aiStatus: 'skipped' as AiStatus, aiFlags: null, aiError: null }
    case 'error':
      return { ...base, aiStatus: 'error' as AiStatus, aiFlags: null, aiError: outcome.message.slice(0, 300) }
  }
}

/** Items that need human attention before anything else in the queue. */
export function isUrgentForReview(p: { aiFlags: Array<AiFlag> | null; hiddenReason: string | null }): boolean {
  if (p.hiddenReason === 'urgent_report') return true
  return (p.aiFlags ?? []).some((f) => f.category === 'sexual_minors')
}

/** Moderator previews are blurred by default for potentially harmful content. */
export function shouldBlurForModerator(p: {
  aiFlags: Array<AiFlag> | null
  hiddenReason: string | null
  hasMinor: boolean
}): boolean {
  if (isUrgentForReview(p)) return true
  return (p.aiFlags ?? []).some((f) => ['nudity', 'sexual', 'graphic_violence'].includes(f.category))
}

export function retentionDeadline(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000)
}
