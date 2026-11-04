import { Link, createFileRoute } from '@tanstack/react-router'
import { useFormatter, useTranslations } from 'use-intl'
import { listLog } from '@/functions/admin.functions'
import { EmptyState } from '@/components/ui/Editorial'
import { useAppLocale } from '@/i18n/react'
import { headTranslator, privateHead } from '@/lib/seo'
import { posInt } from '@/lib/search-params'

export const Route = createFileRoute('/$locale/admin/log')({
  validateSearch: (s: Record<string, unknown>): { page?: number } => ({ page: posInt(s.page, 1000) }),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: ({ deps }) => listLog({ data: deps }),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('admin.log.title') ?? 'SOURA'),
  component: LogPage,
})

function LogPage() {
  const t = useTranslations('admin.log')
  const common = useTranslations('common')
  const format = useFormatter()
  const locale = useAppLocale()
  const data = Route.useLoaderData()
  return (
    <div className="container-page py-10">
      <h1 className="text-display-md">{t('title')}</h1>
      {data.entries.length === 0 ? (
        <EmptyState className="mt-10" title={t('empty')} />
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-start text-small">
            <tbody className="divide-y divide-line">
              {data.entries.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="tabular py-2.5 pe-4 whitespace-nowrap text-ink-subtle">
                    {format.dateTime(new Date(e.createdAt), { dateStyle: 'short', timeStyle: 'medium' })}
                  </td>
                  <td className="py-2.5 pe-4 font-mono text-ink">{e.action}</td>
                  <td className="py-2.5 pe-4 font-mono text-ink-muted">
                    {e.targetType === 'photo' ? (
                      <Link to="/$locale/admin/review/$id" params={{ locale, id: e.targetId }} className="link">
                        {e.targetId}
                      </Link>
                    ) : (
                      `${e.targetType}:${e.targetId}`
                    )}
                  </td>
                  <td className="py-2.5 pe-4 text-ink-muted">{e.actor ?? t('system')}</td>
                  <td className="max-w-xs truncate py-2.5 font-mono text-micro text-ink-subtle">
                    {e.details ? JSON.stringify(e.details) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-6 flex gap-3">
        {data.page > 1 ? (
          <Link to="/$locale/admin/log" params={{ locale }} search={{ page: data.page - 1 }} className="btn btn-secondary btn-sm">
            {common('previous')}
          </Link>
        ) : null}
        {data.hasMore ? (
          <Link to="/$locale/admin/log" params={{ locale }} search={{ page: data.page + 1 }} className="btn btn-secondary btn-sm">
            {common('next')}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
