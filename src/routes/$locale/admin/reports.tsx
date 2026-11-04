import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useFormatter, useTranslations } from 'use-intl'
import { listReports, resolveReport } from '@/functions/admin.functions'
import { EmptyState } from '@/components/ui/Editorial'
import { Button } from '@/components/ui/Button'
import { useAppLocale } from '@/i18n/react'
import { headTranslator, privateHead } from '@/lib/seo'
import { oneOf } from '@/lib/search-params'
import { cx } from '@/lib/cx'

const STATUSES = ['open', 'resolved', 'dismissed'] as const

export const Route = createFileRoute('/$locale/admin/reports')({
  validateSearch: (s: Record<string, unknown>): { status?: (typeof STATUSES)[number] } => ({ status: oneOf(s.status, STATUSES) }),
  loaderDeps: ({ search }) => ({ status: search.status ?? 'open' }),
  loader: ({ deps }) => listReports({ data: deps }),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('admin.reports.title') ?? 'SOURA'),
  component: ReportsPage,
})

function ReportsPage() {
  const t = useTranslations('admin.reports')
  const reasons = useTranslations('moderation.report')
  const format = useFormatter()
  const locale = useAppLocale()
  const router = useRouter()
  const reports = Route.useLoaderData()
  const { status = 'open' } = Route.useSearch()
  const resolveFn = useServerFn(resolveReport)
  const [busy, setBusy] = useState<string | null>(null)

  async function close(id: string, s: 'resolved' | 'dismissed') {
    setBusy(id)
    try {
      await resolveFn({ data: { id, status: s, note: '' } })
      await router.invalidate()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="container-page py-10">
      <h1 className="text-display-md">{t('title')}</h1>
      <nav className="mt-6 flex flex-wrap gap-2" aria-label={t('title')}>
        {STATUSES.map((s) => (
          <Link key={s} to="/$locale/admin/reports" params={{ locale }} search={{ status: s }} className="chip" aria-current={status === s ? 'true' : undefined}>
            {t(`status.${s}`)}
          </Link>
        ))}
      </nav>
      {reports.length === 0 ? (
        <EmptyState className="mt-10" title={t('empty')} />
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {reports.map((r) => (
            <li key={r.id} className="grid gap-3 py-5 md:grid-cols-12">
              <div className="md:col-span-7">
                <p className={cx('font-semibold', r.reason === 'csam' && 'text-danger')}>{reasons(r.reason)}</p>
                <p className="mt-1 text-small text-ink-muted">
                  {format.dateTime(new Date(r.createdAt), { dateStyle: 'medium', timeStyle: 'short' })} · {t(`source.${r.source}`)}
                </p>
                {r.details ? <p className="mt-2 whitespace-pre-line text-small">{r.details}</p> : null}
                {r.reporterEmail ? (
                  <p className="mt-1 text-small text-ink-muted">
                    <span className="eyebrow me-2">{t('reporter')}</span>
                    {r.reporterName} &lt;{r.reporterEmail}&gt;
                  </p>
                ) : null}
                {r.photoUrl ? <p className="mt-1 break-all font-mono text-micro text-ink-subtle">{r.photoUrl}</p> : null}
              </div>
              <div className="flex flex-wrap items-start gap-2 md:col-span-5 md:justify-end">
                {r.photoId && !r.photoLocked ? (
                  <Link to="/$locale/admin/review/$id" params={{ locale, id: r.photoId }} className="btn btn-secondary btn-sm">
                    {t('openPhoto')}
                  </Link>
                ) : !r.photoId ? (
                  <span className="text-small text-ink-subtle">{t('noPhoto')}</span>
                ) : null}
                {r.status === 'open' ? (
                  <>
                    <Button size="sm" variant="ghost" busy={busy === r.id} onClick={() => close(r.id, 'dismissed')}>
                      {t('dismiss')}
                    </Button>
                    <Button size="sm" variant="ghost" busy={busy === r.id} onClick={() => close(r.id, 'resolved')}>
                      {t('resolve')}
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
