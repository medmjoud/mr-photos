import { useState } from 'react'
import { Link, createFileRoute, useLoaderData, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useFormatter, useTranslations } from 'use-intl'
import { deleteMyPhoto, listMyPhotos } from '@/functions/photos.functions'
import { EmptyState, Eyebrow } from '@/components/ui/Editorial'
import { StatusBadge, type BadgeStatus } from '@/components/ui/StatusBadge'
import { Icon } from '@/components/ui/Icon'
import { Notice } from '@/components/ui/Notice'
import { useAppLocale, useErrorText } from '@/i18n/react'
import { regionName } from '@/lib/regions'
import { headTranslator, privateHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/dashboard/')({
  loader: () => listMyPhotos(),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('dashboard.title') ?? 'SOURA'),
  component: Dashboard,
})

type Item = Awaited<ReturnType<typeof listMyPhotos>>['photos'][number]

function badgeFor(p: Item): BadgeStatus {
  if (p.processing === 'failed') return 'failed'
  if (p.status === 'approved' && p.hidden) return 'hidden'
  if (p.status === 'pending' && p.processing !== 'ready') return 'processing'
  return p.status
}

function Dashboard() {
  const t = useTranslations('dashboard')
  const locale = useAppLocale()
  const { me } = useLoaderData({ from: '/$locale' })
  const { photos, totals } = Route.useLoaderData()

  const stats = [
    { label: t('stats.published'), value: totals.published },
    { label: t('stats.pending'), value: totals.pending },
    { label: t('stats.views'), value: totals.views },
    { label: t('stats.contacts'), value: totals.contacts },
    { label: t('stats.profileViews'), value: totals.profileViews },
  ]

  return (
    <div className="container-page pt-12 pb-24 md:pt-16">
      <header className="grid gap-8 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <Eyebrow>{t('title')}</Eyebrow>
          <h1 className="mt-4 text-display-xl">{t('greeting', { name: me?.displayName ?? '' })}</h1>
          <p className="mt-4 max-w-[52ch] text-ink-muted">{t('lead')}</p>
        </div>
        <div className="flex flex-wrap gap-3 md:col-span-5 md:justify-end">
          <Link to="/$locale/dashboard/upload" params={{ locale }} className="btn btn-primary">
            <Icon name="upload" size={18} />
            {t('uploadCta')}
          </Link>
          <Link to="/$locale/dashboard/profile" params={{ locale }} className="btn btn-secondary">
            {t('profileCta')}
          </Link>
        </div>
      </header>

      <section aria-label={t('title')} className="mt-14">
        <dl className="grid grid-cols-2 border-y border-line sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s, i) => (
            <div key={s.label} className={i ? 'border-line py-6 sm:border-s sm:ps-6' : 'py-6'}>
              <dt className="text-small text-ink-muted">{s.label}</dt>
              <dd className="tabular mt-1 font-display text-display-md">{s.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-small text-ink-subtle">{t('statsNote')}</p>
      </section>

      <section className="mt-16" aria-labelledby="my-photos">
        <h2 id="my-photos" className="text-display-md">
          {t('photosTitle')}
        </h2>
        {photos.length === 0 ? (
          <EmptyState
            className="mt-8"
            title={t('emptyTitle')}
            body={t('emptyBody')}
            action={
              <Link to="/$locale/dashboard/upload" params={{ locale }} className="btn btn-primary">
                {t('uploadCta')}
              </Link>
            }
          />
        ) : (
          <ul className="mt-8 grid gap-px bg-line md:grid-cols-2">
            {photos.map((p) => (
              <PhotoRow key={p.id} p={p} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function PhotoRow({ p }: { p: Item }) {
  const t = useTranslations('dashboard')
  const reasons = useTranslations('moderation.rejection')
  const common = useTranslations('common')
  const format = useFormatter()
  const locale = useAppLocale()
  const router = useRouter()
  const deleteFn = useServerFn(deleteMyPhoto)
  const errorText = useErrorText()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const badge = badgeFor(p)
  const hint =
    badge === 'processing'
      ? t('hint.processing')
      : badge === 'pending'
        ? t('hint.pending')
        : badge === 'hidden'
          ? t('hint.hidden')
          : badge === 'failed'
            ? t('hint.failed')
            : badge === 'removed'
              ? t('hint.removed')
              : null

  return (
    <li className="flex gap-5 bg-bg p-5">
      <div
        className="photo-frame h-28 w-28 flex-none sm:h-36 sm:w-36"
        style={p.blur ? { backgroundImage: `url(${p.blur})` } : undefined}
      >
        {p.thumb ? <img src={p.thumb} alt="" loading="lazy" decoding="async" width={144} height={144} /> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={badge} />
        </div>
        <h3 className="truncate font-sans text-body font-semibold">{p.title}</h3>
        <p className="text-small text-ink-muted">
          {regionName(p.regionSlug, locale)} · {t('uploadedOn', { date: format.dateTime(new Date(p.createdAt), { dateStyle: 'medium' }) })}
        </p>
        {hint ? <p className="text-small text-ink-muted">{hint}</p> : null}
        {p.status === 'rejected' && p.rejectionReason ? (
          <div className="text-small">
            <p className="eyebrow">{t('reason')}</p>
            <p className="mt-0.5">{reasons(p.rejectionReason)}</p>
            {p.rejectionNote ? (
              <>
                <p className="eyebrow mt-2">{t('note')}</p>
                <p className="mt-0.5 text-ink-muted">{p.rejectionNote}</p>
              </>
            ) : null}
          </div>
        ) : null}
        {p.deleteAfter ? (
          <p className="text-small text-ink-subtle">
            {t('deletesOn', { date: format.dateTime(new Date(p.deleteAfter), { dateStyle: 'medium' }) })}
          </p>
        ) : null}
        {p.status === 'approved' ? (
          <p className="tabular text-small text-ink-muted">
            {t('views', { count: p.views })} · {t('contacts', { count: p.contacts })}
          </p>
        ) : null}
        {error ? <Notice kind="danger">{error}</Notice> : null}
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1 text-small">
          {p.publicSegment ? (
            <Link to="/$locale/photos/$slug" params={{ locale, slug: p.publicSegment }} className="link">
              {t('viewPublic')}
            </Link>
          ) : null}
          {p.canEdit ? (
            <Link to="/$locale/dashboard/photos/$id" params={{ locale, id: p.id }} className="link">
              {t('edit')}
            </Link>
          ) : null}
          {p.canDelete ? (
            <button
              type="button"
              className="link text-danger"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm(t('deleteConfirm', { title: p.title }))) return
                setBusy(true)
                setError(null)
                try {
                  await deleteFn({ data: { id: p.id } })
                  await router.invalidate()
                } catch (err) {
                  setError(errorText(err))
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? common('loading') : t('delete')}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  )
}
