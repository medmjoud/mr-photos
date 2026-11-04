import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useTranslations } from 'use-intl'
import { adminStats } from '@/functions/admin.functions'
import { decideAvatar, listPendingAvatars } from '@/functions/profile.functions'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Editorial'
import { useAppLocale } from '@/i18n/react'
import { headTranslator, privateHead } from '@/lib/seo'
import { cx } from '@/lib/cx'

export const Route = createFileRoute('/$locale/admin/')({
  loader: async () => {
    const [stats, avatars] = await Promise.all([adminStats(), listPendingAvatars()])
    return { ...stats, avatars }
  },
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('admin.title') ?? 'SOURA'),
  component: AdminOverview,
})

function AdminOverview() {
  const t = useTranslations('admin')
  const locale = useAppLocale()
  const s = Route.useLoaderData()

  const attention = [
    { label: t('stats.urgent'), value: s.urgent, filter: 'urgent' as const, tone: 'danger' },
    { label: t('stats.pending'), value: s.photos.pending, filter: 'pending' as const, tone: 'warn' },
    { label: t('stats.hidden'), value: s.hidden, filter: 'hidden' as const, tone: 'warn' },
    { label: t('stats.failed'), value: s.failed, filter: 'failed' as const, tone: 'warn' },
  ]
  const totals = [
    { label: t('stats.openReports'), value: s.openReports },
    { label: t('stats.approved'), value: s.photos.approved },
    { label: t('stats.rejected'), value: s.photos.rejected },
    { label: t('stats.photographers'), value: s.photographers },
    { label: t('stats.users'), value: s.users },
    { label: t('stats.suspended'), value: s.suspended },
    { label: t('stats.uploads7'), value: s.uploads7 },
    { label: t('stats.views30'), value: s.views30 },
    { label: t('stats.contacts30'), value: s.contacts30 },
  ]

  return (
    <div className="container-page py-12">
      <Eyebrow>{t('nav.overview')}</Eyebrow>
      <h1 className="mt-3 text-display-lg">{t('title')}</h1>

      <ul className="mt-10 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        {attention.map((a) => (
          <li key={a.label} className="bg-bg">
            <Link
              to="/$locale/admin/review"
              params={{ locale }}
              search={{ filter: a.filter }}
              className="group flex h-full flex-col gap-2 p-6 transition-colors hover:bg-surface"
            >
              <span className="text-small text-ink-muted">{a.label}</span>
              <span
                className={cx(
                  'tabular font-display text-display-lg',
                  a.value > 0 && (a.tone === 'danger' ? 'text-danger' : 'text-warn'),
                )}
              >
                {a.value}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-line pt-8 sm:grid-cols-3 lg:grid-cols-5">
        {totals.map((x) => (
          <div key={x.label}>
            <dt className="text-small text-ink-muted">{x.label}</dt>
            <dd className="tabular mt-1 font-display text-display-md">{x.value}</dd>
          </div>
        ))}
      </dl>

      <PendingAvatars avatars={s.avatars} />
    </div>
  )
}

function PendingAvatars({ avatars }: { avatars: Array<{ userId: string; displayName: string; url: string | null }> }) {
  const t = useTranslations('adminAvatars')
  const router = useRouter()
  const decideFn = useServerFn(decideAvatar)
  const [busy, setBusy] = useState<string | null>(null)
  return (
    <section className="mt-14 border-t border-line pt-8" aria-labelledby="avatars-title">
      <h2 id="avatars-title" className="text-title">
        {t('title')}
      </h2>
      {avatars.length === 0 ? (
        <p className="mt-3 text-small text-ink-muted">{t('empty')}</p>
      ) : (
        <ul className="mt-6 grid gap-6 sm:grid-cols-3 lg:grid-cols-6">
          {avatars.map((a) => (
            <li key={a.userId} className="flex flex-col gap-3">
              <div className="photo-frame aspect-square">{a.url ? <img src={a.url} alt="" /> : null}</div>
              <p className="truncate text-small font-semibold">{a.displayName}</p>
              <div className="flex gap-2">
                {[true, false].map((approve) => (
                  <Button
                    key={String(approve)}
                    size="sm"
                    variant={approve ? 'secondary' : 'danger'}
                    busy={busy === a.userId + String(approve)}
                    onClick={async () => {
                      setBusy(a.userId + String(approve))
                      await decideFn({ data: { userId: a.userId, approve } }).catch(() => undefined)
                      setBusy(null)
                      await router.invalidate()
                    }}
                  >
                    {approve ? t('approve') : t('reject')}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
