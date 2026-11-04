import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { checkAccess } from '@/functions/guards.functions'

/** UX guard: signed-in, verified, active photographers (and admins). */
export const Route = createFileRoute('/$locale/dashboard')({
  beforeLoad: async ({ params, location }) => {
    const access = await checkAccess()
    if (!access.signedIn) {
      throw redirect({ to: '/$locale/auth/login', params, search: { next: location.href } })
    }
    if (!access.canUpload) {
      throw redirect({ to: '/$locale/auth/login', params })
    }
  },
  component: Outlet,
})
