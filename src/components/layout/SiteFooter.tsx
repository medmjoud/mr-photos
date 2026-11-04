import { Link } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { useAppLocale } from '@/i18n/react'
import { LanguageSwitcher } from './LanguageSwitcher'
import { Wordmark } from './Wordmark'

export function SiteFooter() {
  const t = useTranslations('footer')
  const nav = useTranslations('nav')
  const meta = useTranslations('meta')
  const locale = useAppLocale()
  const year = new Date().getFullYear()

  const cols = [
    {
      title: t('explore'),
      links: [
        { to: '/$locale/explore', label: nav('explore') },
        { to: '/$locale/photographers', label: nav('photographers') },
      ],
    },
    {
      title: t('project'),
      links: [
        { to: '/$locale/about', label: nav('about') },
        { to: '/$locale/for-photographers', label: nav('forPhotographers') },
      ],
    },
    {
      title: t('legal'),
      links: [
        { to: '/$locale/content-rules', label: t('contentRules') },
        { to: '/$locale/terms', label: t('terms') },
        { to: '/$locale/privacy', label: t('privacy') },
        { to: '/$locale/report', label: t('report') },
      ],
    },
  ] as const

  return (
    <footer className="mt-auto border-t border-line bg-bg-raised">
      <div className="container-page grid gap-12 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Wordmark size="xl" />
          <p className="mt-6 max-w-[38ch] font-display text-title italic text-ink-muted">{meta('tagline')}</p>
          <p className="mt-6 max-w-[48ch] text-small text-ink-muted">{t('statement')}</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
          {cols.map((col) => (
            <div key={col.title}>
              <h2 className="eyebrow mb-4 font-sans">{col.title}</h2>
              <ul className="flex flex-col gap-1">
                {col.links.map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      params={{ locale }}
                      className="inline-flex min-h-10 items-center text-small text-ink-muted transition-colors hover:text-ink"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="container-page flex flex-col gap-3 border-t border-line py-6 text-small text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
        <p>{t('rights', { year })}</p>
        <p>{t('noCookies')}</p>
        <LanguageSwitcher />
      </div>
    </footer>
  )
}
