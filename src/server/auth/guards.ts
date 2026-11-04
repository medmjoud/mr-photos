import { createMiddleware } from '@tanstack/react-start'
import { canAccessAdmin, canUpload } from '@/lib/permissions'
import { getSessionUser, toActor, type SessionUser } from './session'
import { fail } from '../http'

/**
 * Server-function middleware. Every protected server function MUST include
 * one of these; route guards (beforeLoad) only improve navigation UX.
 * Errors carry stable codes that the UI translates.
 */


export const withUser = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const user = await getSessionUser()
  return next({ context: { user, actor: toActor(user) } })
})

export const requireUser = createMiddleware({ type: 'function' })
  .middleware([withUser])
  .server(async ({ next, context }) => {
    const user: SessionUser | null = context.user
    if (!user) fail('unauthorized', 401)
    if (!canUpload(toActor(user))) fail(user.emailVerifiedAt ? 'forbidden' : 'email_unverified', 403)
    return next({ context: { user } })
  })

export const requireAdmin = createMiddleware({ type: 'function' })
  .middleware([withUser])
  .server(async ({ next, context }) => {
    const user: SessionUser | null = context.user
    if (!user) fail('unauthorized', 401)
    if (!canAccessAdmin(toActor(user))) fail('forbidden', 403)
    return next({ context: { user } })
  })
