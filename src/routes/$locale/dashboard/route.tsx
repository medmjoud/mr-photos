import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { checkAccess } from '@/functions/guards.functions'
import { PrivateMessages } from '@/components/layout/PrivateMessages'
import { loadMessages } from '@/i18n/load'
import { isLocale } from '@/i18n/config'

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
  loader: async ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : 'fr'
    return { locale, messages: await loadMessages(locale, 'all') }
  },
  staleTime: Number.POSITIVE_INFINITY,
  component: DashboardLayout,
})

function DashboardLayout() {
  const { locale, messages } = Route.useLoaderData()
  return (
    <PrivateMessages locale={locale} messages={messages}>
      <Outlet />
    </PrivateMessages>
  )
}
