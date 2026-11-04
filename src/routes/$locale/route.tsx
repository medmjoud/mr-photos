import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'
import { IntlProvider, useTranslations } from 'use-intl'
import frauncesLatin from '@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2?url'
import schibstedLatin from '@fontsource-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2?url'
import plexArabic from '@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2?url'
import markaziArabic from '@fontsource-variable/markazi-text/files/markazi-text-arabic-wght-normal.woff2?url'
import { isLocale, type Locale } from '@/i18n/config'
import { loadMessages } from '@/i18n/load'
import { getShell } from '@/functions/shell.functions'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { NotFound } from '@/components/layout/NotFound'
import { RevealObserver } from '@/components/layout/RevealObserver'
import { DemoBanner } from '@/components/layout/DemoBanner'

export const Route = createFileRoute('/$locale')({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale)) throw notFound()
  },
  loader: async ({ params }) => {
    const locale = params.locale as Locale
    const [messages, shell] = await Promise.all([loadMessages(locale), getShell()])
    return { locale, messages, ...shell }
  },
  // Messages are static; the user part is refreshed with router.invalidate() after sign-in/out.
  staleTime: Number.POSITIVE_INFINITY,
  head: ({ loaderData }) => {
    const ar = loaderData?.locale === 'ar'
    const fonts = ar ? [plexArabic, markaziArabic] : [schibstedLatin, frauncesLatin]
    return {
      links: fonts.map((href) => ({
        rel: 'preload',
        href,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      })),
      scripts: loaderData?.analytics
        ? [{ src: loaderData.analytics.src, defer: true, 'data-domain': loaderData.analytics.domain }]
        : [],
    }
  },
  component: LocaleLayout,
  notFoundComponent: NotFound,
})

function LocaleLayout() {
  const { locale, messages } = Route.useLoaderData()
  return (
    <IntlProvider locale={locale} messages={messages} timeZone="Africa/Nouakchott">
      <SkipLink />
      <div className="flex min-h-dvh flex-col">
        <DemoBanner />
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <RevealObserver />
    </IntlProvider>
  )
}

function SkipLink() {
  const t = useTranslations('nav')
  return (
    <a
      href="#main"
      className="btn btn-primary fixed start-4 top-2 z-50 -translate-y-24 focus:translate-y-0"
    >
      {t('skipToContent')}
    </a>
  )
}
