import { Link, useMatch } from '@tanstack/react-router'
import { IntlProvider, useTranslations } from 'use-intl'
import { useAppLocale } from '@/i18n/react'

/**
 * 404. Inside a locale it is fully translated; for URLs with no valid locale
 * (no messages loaded) it falls back to a short trilingual page.
 */
export function NotFound() {
  const match = useMatch({ from: '/$locale', shouldThrow: false })
  const data = match?.loaderData
  if (!data) return <StaticNotFound />
  return (
    <IntlProvider locale={data.locale} messages={data.messages} timeZone="Africa/Nouakchott">
      <LocalizedNotFound />
    </IntlProvider>
  )
}

function LocalizedNotFound() {
  const t = useTranslations('notFound')
  const locale = useAppLocale()
  return (
    <section className="container-page grid min-h-[70dvh] content-center gap-8 py-20 md:grid-cols-12">
      <div className="md:col-span-8">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1 className="mt-4 text-display-xl">{t('title')}</h1>
        <p className="mt-6 max-w-[52ch] text-body-lg text-ink-muted">{t('body')}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/$locale/explore" params={{ locale }} className="btn btn-primary">
            {t('explore')}
          </Link>
          <Link to="/$locale" params={{ locale }} className="btn btn-secondary">
            {t('home')}
          </Link>
        </div>
      </div>
      <p aria-hidden className="select-none font-display text-[clamp(8rem,30vw,22rem)] leading-none text-surface-2 md:col-span-4 md:text-end">
        404
      </p>
    </section>
  )
}

function StaticNotFound() {
  return (
    <main id="main" className="container-page grid min-h-dvh content-center gap-6 py-20">
      <p className="eyebrow">404</p>
      <h1 className="text-display-lg" lang="fr">
        Page introuvable.
      </h1>
      <p className="font-display text-display-md" lang="ar" dir="rtl">
        الصفحة غير موجودة.
      </p>
      <p className="font-display text-display-md text-ink-muted" lang="en">
        Page not found.
      </p>
      <div className="flex gap-3">
        <a href="/fr" className="btn btn-primary" lang="fr">
          Accueil
        </a>
        <a href="/ar" className="btn btn-secondary" lang="ar">
          الرئيسية
        </a>
        <a href="/en" className="btn btn-secondary" lang="en">
          Home
        </a>
      </div>
    </main>
  )
}
