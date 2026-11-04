/**
 * Pure permission rules, shared by server handlers and UI. The server is the
 * only enforcement point — the UI uses these only to hide controls.
 */

export type Actor = {
  id: string
  role: 'photographer' | 'admin'
  status: 'active' | 'suspended'
  emailVerified: boolean
} | null

export type PhotoAccessFacts = {
  ownerId: string
  status: 'pending' | 'approved' | 'rejected' | 'removed'
  csamLockedAt: Date | number | null
  legalHold?: boolean
}

function isActive(a: Actor): a is NonNullable<Actor> {
  return a !== null && a.status === 'active' && a.emailVerified
}

export function isAdmin(a: Actor): boolean {
  return isActive(a) && a.role === 'admin'
}

/** Admin area, review queue, reports, users, stats. */
export function canAccessAdmin(a: Actor): boolean {
  return isAdmin(a)
}

export function canModerate(a: Actor): boolean {
  return isAdmin(a)
}

export function canUpload(a: Actor): boolean {
  return isActive(a)
}

export function canManageOwnProfile(a: Actor): boolean {
  return isActive(a)
}

/**
 * Original files and private derivatives (pending previews). Owners and
 * admins only — and nobody, including staff, once a photo is CSAM-locked.
 */
export function canViewPrivateFile(a: Actor, photo: PhotoAccessFacts): boolean {
  if (!isActive(a)) return false
  if (photo.csamLockedAt) return false
  if (photo.status === 'removed') return a.role === 'admin'
  return a.role === 'admin' || a.id === photo.ownerId
}

/** Only the original uploader may download their own original, never admins on CSAM lock. */
export function canDownloadOriginal(a: Actor, photo: PhotoAccessFacts): boolean {
  return canViewPrivateFile(a, photo)
}

export function canEditPhotoMetadata(a: Actor, photo: PhotoAccessFacts): boolean {
  if (!isActive(a) || photo.csamLockedAt) return false
  if (a.role === 'admin') return photo.status !== 'removed'
  return a.id === photo.ownerId && photo.status === 'pending'
}

export function canDeletePhoto(a: Actor, photo: PhotoAccessFacts): boolean {
  if (!isActive(a)) return false
  // Material under legal hold (e.g. CSAM procedure) must be preserved.
  if (photo.csamLockedAt || photo.legalHold) return false
  return a.role === 'admin' || a.id === photo.ownerId
}

export function canSuspendUser(a: Actor, targetUserId: string, targetRole: 'photographer' | 'admin'): boolean {
  if (!a || !isAdmin(a)) return false
  if (a.id === targetUserId) return false // never lock yourself out
  return targetRole === 'photographer'
}
