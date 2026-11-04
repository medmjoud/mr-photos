import { describe, expect, it } from 'vitest'
import {
  canAccessAdmin,
  canDeletePhoto,
  canEditPhotoMetadata,
  canModerate,
  canSuspendUser,
  canUpload,
  canViewPrivateFile,
  type Actor,
} from '@/lib/permissions'

const admin: Actor = { id: 'admin', role: 'admin', status: 'active', emailVerified: true }
const owner: Actor = { id: 'owner', role: 'photographer', status: 'active', emailVerified: true }
const other: Actor = { id: 'other', role: 'photographer', status: 'active', emailVerified: true }
const unverified: Actor = { ...owner, emailVerified: false }
const suspendedAdmin: Actor = { ...admin, status: 'suspended' }
const unverifiedAdmin: Actor = { ...admin, emailVerified: false }

const pending = { ownerId: 'owner', status: 'pending' as const, csamLockedAt: null }
const approved = { ...pending, status: 'approved' as const }
const locked = { ...pending, csamLockedAt: new Date() }

describe('admin access', () => {
  it('only active, verified admins can moderate or open admin routes', () => {
    expect(canAccessAdmin(admin)).toBe(true)
    expect(canModerate(admin)).toBe(true)
    for (const a of [null, owner, other, unverified, suspendedAdmin, unverifiedAdmin]) {
      expect(canAccessAdmin(a)).toBe(false)
      expect(canModerate(a)).toBe(false)
    }
  })
})

describe('uploads', () => {
  it('requires an active, verified account', () => {
    expect(canUpload(owner)).toBe(true)
    expect(canUpload(null)).toBe(false)
    expect(canUpload(unverified)).toBe(false)
    expect(canUpload({ ...owner, status: 'suspended' })).toBe(false)
  })
})

describe('private files (originals, pending previews)', () => {
  it('are visible to the owner and admins only', () => {
    expect(canViewPrivateFile(owner, pending)).toBe(true)
    expect(canViewPrivateFile(admin, pending)).toBe(true)
    expect(canViewPrivateFile(other, pending)).toBe(false)
    expect(canViewPrivateFile(null, pending)).toBe(false)
  })
  it('are visible to nobody once CSAM-locked — not even admins', () => {
    expect(canViewPrivateFile(owner, locked)).toBe(false)
    expect(canViewPrivateFile(admin, locked)).toBe(false)
  })
})

describe('editing and deletion', () => {
  it('owners edit only pending photos; admins can edit non-removed ones', () => {
    expect(canEditPhotoMetadata(owner, pending)).toBe(true)
    expect(canEditPhotoMetadata(owner, approved)).toBe(false)
    expect(canEditPhotoMetadata(other, pending)).toBe(false)
    expect(canEditPhotoMetadata(admin, approved)).toBe(true)
    expect(canEditPhotoMetadata(admin, locked)).toBe(false)
  })
  it('material under legal hold cannot be deleted by anyone', () => {
    expect(canDeletePhoto(owner, approved)).toBe(true)
    expect(canDeletePhoto(other, approved)).toBe(false)
    expect(canDeletePhoto(owner, locked)).toBe(false)
    expect(canDeletePhoto(admin, { ...approved, legalHold: true })).toBe(false)
  })
})

describe('suspensions', () => {
  it('admins can suspend photographers, never themselves or other admins', () => {
    expect(canSuspendUser(admin, 'owner', 'photographer')).toBe(true)
    expect(canSuspendUser(admin, 'admin', 'photographer')).toBe(false)
    expect(canSuspendUser(admin, 'admin2', 'admin')).toBe(false)
    expect(canSuspendUser(owner, 'other', 'photographer')).toBe(false)
  })
})
