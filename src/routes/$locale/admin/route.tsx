import { Outlet, createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { checkAccess } from '@/functions/guards.functions'

/** UX guard: admins only. Non-admins get a 404 so the area is not advertised. */
export const Route = createFileRoute('/$locale/admin')({
  beforeLoad: async ({ params, location }) => {
    const access = await checkAccess()
    if (!access.signedIn) {
      throw redirect({ to: '/$locale/auth/login', params, search: { next: location.href } })
    }
    if (!access.isAdmin) throw notFound()
  },
  component: Outlet,
})
