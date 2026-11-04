import { Link, createFileRoute } from '@tanstack/react-router'
import { useFormatter, useTranslations } from 'use-intl'
import { QUEUE_FILTERS, reviewQueue } from '@/functions/admin.functions'
import { ModeratorPreview } from '@/components/admin/ModeratorPreview'
import { EmptyState } from '@/components/ui/Editorial'
import { Icon } from '@/components/ui/Icon'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useAppLocale } from '@/i18n/react'
import { regionName } from '@/lib/regions'
import { headTranslator, privateHead } from '@/lib/seo'
import { oneOf, posInt } from '@/lib/search-params'

export const Route = createFileRoute('/$locale/admin/review/')({
  validateSearch: (s: Record<string, unknown>): { filter?: (typeof QUEUE_FILTERS)[number]; page?: number } => ({
    filter: oneOf(s.filter, QUEUE_FILTERS),
    page: posInt(s.page),
  }),
  loaderDeps: ({ search }) => ({ filter: search.filter ?? 'pending', page: search.page ?? 1 }),
  loader: ({ deps }) => reviewQueue({ data: deps }),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('admin.nav.review') ?? 'SOURA'),
  component: ReviewQueue,
})

function ReviewQueue() {
  const t = useTranslations('admin.queue')
  const ai = useTranslations('moderation.ai')
  const aiStatus = useTranslations('moderation.aiStatus')
  const hidden = useTranslations('moderation.hiddenReason')
  const item = useTranslations('admin.item')
  const format = useFormatter()
  const locale = useAppLocale()
  const data = Route.useLoaderData()

  return (
    <div className="container-page py-10">
      <nav aria-label={t('filters.pending')} className="flex flex-wrap gap-2">
        {QUEUE_FILTERS.map((f) => (
          <Link
            key={f}
            to="/$locale/admin/review"
            params={{ locale }}
            search={{ filter: f }}
            className="chip"
            aria-current={data.filter === f ? 'true' : undefined}
          >
            {t(`filters.${f}`)}
          </Link>
        ))}
      </nav>

      {data.items.length === 0 ? (
        <EmptyState className="mt-12" title={t('emptyTitle')} body={t('emptyBody')} />
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((p) => (
            <li key={p.id} className="flex flex-col border border-line bg-bg-raised">
              <ModeratorPreview src={p.preview} width={p.width} height={p.height} blur={p.blur} locked={p.csamLocked} />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {p.urgent ? (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-danger px-2.5 py-0.5 text-micro font-bold text-bg">
                      <Icon name="alert" size={14} />
                      {t('filters.urgent')}
                    </span>
                  ) : null}
                  <StatusBadge status={p.processing === 'failed' ? 'failed' : p.processing !== 'ready' ? 'processing' : p.hidden ? 'hidden' : p.status} />
                  {p.reports > 0 ? (
                    <span className="text-micro font-semibold text-danger">
                      <Icon name="flag" size={14} className="inline" /> {p.reports}
                    </span>
                  ) : null}
                </div>
                <h2 className="font-sans text-body font-semibold">{p.title}</h2>
                <p className="text-small text-ink-muted">
                  {p.authorName} · {regionName(p.regionSlug, locale)} · {p.yearTaken}
                </p>
                <p className="text-small text-ink-subtle">{item('uploaded', { date: format.dateTime(new Date(p.createdAt), { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
                {p.hiddenReason ? <p className="text-small text-danger">{hidden(p.hiddenReason)}</p> : null}
                <p className="text-small">
                  <span className={p.aiStatus === 'flagged' ? 'text-danger' : 'text-ink-muted'}>{aiStatus(p.aiStatus)}</span>
                  {p.aiFlags.length ? ` — ${p.aiFlags.map((f) => ai(f.category)).join(', ')}` : ''}
                </p>
                {p.hasMinor ? <p className="text-small font-semibold text-warn">{item('minor')}</p> : null}
                <Link
                  to="/$locale/admin/review/$id"
                  params={{ locale, id: p.id }}
                  className="btn btn-secondary btn-sm mt-auto w-fit"
                >
                  {t('open')}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data.hasMore ? (
        <Link
          to="/$locale/admin/review"
          params={{ locale }}
          search={{ filter: data.filter, page: data.page + 1 }}
          className="btn btn-secondary mt-10"
        >
          {t('more')}
        </Link>
      ) : null}
    </div>
  )
}
