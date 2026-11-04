import type { ReactNode } from 'react'
import { HeadContent, Scripts, createRootRoute, useParams, useRouter } from '@tanstack/react-router'
import { dirFor, isLocale, defaultLocale } from '@/i18n/config'
import { themeInitScript } from '@/components/layout/ThemeToggle'
import { NotFound } from '@/components/layout/NotFound'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'theme-color', content: '#0b0d11' },
      { name: 'color-scheme', content: 'dark light' },
      { name: 'format-detection', content: 'telephone=no' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: ReactNode }) {
  const params = useParams({ strict: false })
  const locale = isLocale(params.locale) ? params.locale : defaultLocale
  const nonce = useRouter().options.ssr?.nonce
  return (
    <html lang={locale} dir={dirFor(locale)} data-theme="dark" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
