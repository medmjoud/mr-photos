import { describe, expect, it } from 'vitest'
import {
  aiPatch,
  approvalBlockers,
  autoHideDecision,
  canTransition,
  isPubliclyVisible,
  isUrgentForReview,
  retentionDeadline,
  shouldBlurForModerator,
  type AiOutcome,
  type ModerationFacts,
} from '@/lib/moderation'

const base: ModerationFacts = {
  status: 'approved',
  processing: 'ready',
  hiddenAt: null,
  csamLockedAt: null,
  altFr: 'Une description alternative',
  ownerStatus: 'active',
}

describe('public visibility', () => {
  it('requires approved + ready + not hidden + not locked + active owner', () => {
    expect(isPubliclyVisible(base)).toBe(true)
    expect(isPubliclyVisible({ ...base, status: 'pending' })).toBe(false)
    expect(isPubliclyVisible({ ...base, status: 'rejected' })).toBe(false)
    expect(isPubliclyVisible({ ...base, status: 'removed' })).toBe(false)
    expect(isPubliclyVisible({ ...base, processing: 'processing' })).toBe(false)
    expect(isPubliclyVisible({ ...base, hiddenAt: new Date() })).toBe(false)
    expect(isPubliclyVisible({ ...base, csamLockedAt: new Date() })).toBe(false)
    expect(isPubliclyVisible({ ...base, ownerStatus: 'suspended' })).toBe(false)
  })
})

describe('transitions', () => {
  it('only pending photos can be approved or rejected', () => {
    expect(canTransition('approve', 'pending')).toBe(true)
    expect(canTransition('approve', 'rejected')).toBe(false)
    expect(canTransition('approve', 'approved')).toBe(false)
    expect(canTransition('reject', 'pending')).toBe(true)
    expect(canTransition('reject', 'approved')).toBe(false)
    expect(canTransition('hide', 'approved')).toBe(true)
    expect(canTransition('restore', 'removed')).toBe(false)
  })
})

describe('approval blockers', () => {
  const pending = { ...base, status: 'pending' as const }
  it('allows a ready, pending photo with alt text', () => {
    expect(approvalBlockers(pending, 'Dunes orangées au coucher du soleil')).toEqual([])
  })
  it('requires alt text', () => {
    expect(approvalBlockers(pending, '')).toContain('alt_missing')
    expect(approvalBlockers(pending, 'court')).toContain('alt_missing')
  })
  it('refuses unprocessed, locked or suspended-owner photos', () => {
    expect(approvalBlockers({ ...pending, processing: 'queued' }, 'Texte alternatif ok')).toContain('processing_not_ready')
    expect(approvalBlockers({ ...pending, csamLockedAt: new Date() }, 'Texte alternatif ok')).toContain('csam_locked')
    expect(approvalBlockers({ ...pending, ownerStatus: 'suspended' }, 'Texte alternatif ok')).toContain('owner_suspended')
    expect(approvalBlockers(base, 'Texte alternatif ok')).toContain('not_pending')
  })
})

describe('reports and auto-hide', () => {
  it('hides at the distinct-reporter threshold', () => {
    expect(autoHideDecision({ newReason: 'stolen', distinctOpenReporters: 2, threshold: 3, alreadyHidden: false }).hide).toBe(false)
    expect(autoHideDecision({ newReason: 'stolen', distinctOpenReporters: 3, threshold: 3, alreadyHidden: false })).toEqual({
      hide: true,
      reason: 'reports',
    })
  })
  it('hides immediately on an urgent (child-abuse) report', () => {
    expect(autoHideDecision({ newReason: 'csam', distinctOpenReporters: 1, threshold: 3, alreadyHidden: false })).toEqual({
      hide: true,
      reason: 'urgent_report',
    })
  })
  it('does nothing for already hidden photos', () => {
    expect(autoHideDecision({ newReason: 'csam', distinctOpenReporters: 9, threshold: 3, alreadyHidden: true }).hide).toBe(false)
  })
})

describe('AI outcomes never decide', () => {
  const outcomes: Array<AiOutcome> = [
    { kind: 'result', flags: [], provider: 'x' },
    { kind: 'result', flags: [{ category: 'nudity', score: 0.99 }], provider: 'x' },
    { kind: 'unavailable', provider: 'none' },
    { kind: 'error', provider: 'x', message: 'boom' },
    { kind: 'skipped', provider: 'x' },
  ]
  it('patches contain AI fields only — never status, approval or visibility', () => {
    for (const o of outcomes) {
      const patch = aiPatch(o)
      for (const forbidden of ['status', 'approvedAt', 'approvedBy', 'hiddenAt', 'rejectionReason', 'featured']) {
        expect(patch).not.toHaveProperty(forbidden)
      }
      expect(Object.keys(patch).every((k) => k.startsWith('ai'))).toBe(true)
    }
  })
  it('maps outcomes to statuses', () => {
    expect(aiPatch(outcomes[0]).aiStatus).toBe('clear')
    expect(aiPatch(outcomes[1]).aiStatus).toBe('flagged')
    expect(aiPatch(outcomes[2]).aiStatus).toBe('unavailable')
    expect(aiPatch(outcomes[3]).aiStatus).toBe('error')
    expect(aiPatch(outcomes[4]).aiStatus).toBe('skipped')
  })
})

describe('moderator safety', () => {
  it('treats urgent reports and minor-related AI flags as urgent and blurred', () => {
    expect(isUrgentForReview({ aiFlags: null, hiddenReason: 'urgent_report' })).toBe(true)
    expect(isUrgentForReview({ aiFlags: [{ category: 'sexual_minors', score: 0.3 }], hiddenReason: null })).toBe(true)
    expect(isUrgentForReview({ aiFlags: [{ category: 'hate', score: 0.9 }], hiddenReason: null })).toBe(false)
    expect(shouldBlurForModerator({ aiFlags: [{ category: 'nudity', score: 0.9 }], hiddenReason: null, hasMinor: false })).toBe(true)
    expect(shouldBlurForModerator({ aiFlags: [], hiddenReason: null, hasMinor: false })).toBe(false)
  })
  it('computes the retention deadline', () => {
    const d = new Date('2026-01-01T00:00:00Z')
    expect(retentionDeadline(d, 7).toISOString()).toBe('2026-01-08T00:00:00.000Z')
  })
})
