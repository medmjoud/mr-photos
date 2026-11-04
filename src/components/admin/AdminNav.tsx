import { Link } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { useAppLocale } from '@/i18n/react'

export function AdminNav() {
  const t = useTranslations('admin')
  const locale = useAppLocale()
  const items = [
    { to: '/$locale/admin', label: t('nav.overview'), exact: true },
    { to: '/$locale/admin/review', label: t('nav.review'), exact: false },
    { to: '/$locale/admin/reports', label: t('nav.reports'), exact: false },
    { to: '/$locale/admin/users', label: t('nav.users'), exact: false },
    { to: '/$locale/admin/log', label: t('nav.log'), exact: false },
    { to: '/$locale/admin/child-safety', label: t('nav.childSafety'), exact: false },
  ] as const
  return (
    <div className="border-b border-line bg-bg-raised">
      <nav aria-label={t('title')} className="container-page flex items-center gap-1 overflow-x-auto">
        <span className="eyebrow me-4 hidden shrink-0 sm:inline">{t('title')}</span>
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            params={{ locale }}
            activeOptions={{ exact: i.exact }}
            className="inline-flex min-h-12 shrink-0 items-center border-b-2 border-transparent px-3 text-small text-ink-muted hover:text-ink"
            activeProps={{ className: 'border-accent! text-ink', 'aria-current': 'page' }}
          >
            {i.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
