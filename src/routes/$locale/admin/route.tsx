import { Outlet, createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { checkAccess } from '@/functions/guards.functions'
import { PrivateMessages } from '@/components/layout/PrivateMessages'
import { loadMessages } from '@/i18n/load'
import { isLocale } from '@/i18n/config'
import { AdminNav } from '@/components/admin/AdminNav'

/** UX guard: admins only. Non-admins get a 404 so the area is not advertised. */
export const Route = createFileRoute('/$locale/admin')({
  beforeLoad: async ({ params, location }) => {
    const access = await checkAccess()
    if (!access.signedIn) {
      throw redirect({ to: '/$locale/auth/login', params, search: { next: location.href } })
    }
    if (!access.isAdmin) throw notFound()
  },
  loader: async ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : 'fr'
    return { locale, messages: await loadMessages(locale, 'all') }
  },
  staleTime: Number.POSITIVE_INFINITY,
  component: AdminLayout,
})

function AdminLayout() {
  const { locale, messages } = Route.useLoaderData()
  return (
    <PrivateMessages locale={locale} messages={messages}>
      <AdminNav />
      <Outlet />
    </PrivateMessages>
  )
}
