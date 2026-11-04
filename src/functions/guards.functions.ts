import { createServerFn } from '@tanstack/react-start'
import { getSessionUser, toActor } from '@/server/auth/session'
import { canAccessAdmin, canUpload } from '@/lib/permissions'

/**
 * Navigation guards (UX only). Every protected server function enforces
 * the same rules itself via requireUser / requireAdmin middleware.
 */
export const checkAccess = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getSessionUser()
  const actor = toActor(user)
  return {
    signedIn: user !== null,
    canUpload: canUpload(actor),
    isAdmin: canAccessAdmin(actor),
  }
})
