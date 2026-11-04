import { createFileRoute, redirect } from '@tanstack/react-router'
import { defaultLocale, negotiateLocale } from '@/i18n/config'

/** "/" → best locale from Accept-Language (no cookie). */
export const Route = createFileRoute('/')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const locale = negotiateLocale(request.headers.get('accept-language'))
        return new Response(null, {
          status: 302,
          headers: { Location: `/${locale}`, Vary: 'Accept-Language', 'Cache-Control': 'private, max-age=0' },
        })
      },
    },
  },
  beforeLoad: () => {
    throw redirect({ to: '/$locale', params: { locale: defaultLocale } })
  },
})
