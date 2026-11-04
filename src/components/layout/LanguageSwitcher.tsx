import { useLocation } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { localeNames, locales } from '@/i18n/config'
import { useAppLocale } from '@/i18n/react'
import { cx } from '@/lib/cx'

/** Swaps the locale segment of the current URL (full navigation: dir and fonts change). */
export function localizedHref(pathname: string, searchStr: string, target: string): string {
  const parts = pathname.split('/')
  parts[1] = target
  return `${parts.join('/') || `/${target}`}${searchStr}`
}

export function LanguageSwitcher({ className, variant = 'compact' }: { className?: string; variant?: 'compact' | 'full' }) {
  const t = useTranslations('nav')
  const current = useAppLocale()
  const location = useLocation()
  return (
    <nav aria-label={t('language')} className={className}>
      <ul className={cx('flex items-center', variant === 'compact' ? 'gap-1' : 'flex-col items-start gap-3')}>
        {locales.map((l) => {
          const active = l === current
          return (
            <li key={l}>
              <a
                href={localizedHref(location.pathname, location.searchStr, l)}
                hrefLang={l}
                lang={l}
                aria-current={active ? 'true' : undefined}
                className={cx(
                  'inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-small transition-colors',
                  active ? 'font-semibold text-ink' : 'text-ink-muted hover:text-ink',
                  variant === 'full' && 'justify-start px-0 text-title',
                )}
              >
                {variant === 'compact' ? (
                  <>
                    <span aria-hidden>{l === 'ar' ? 'ع' : l.toUpperCase()}</span>
                    <span className="sr-only">{localeNames[l]}</span>
                  </>
                ) : (
                  localeNames[l]
                )}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
