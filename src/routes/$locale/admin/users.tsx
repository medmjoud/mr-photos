import { useState } from 'react'
import { Link, createFileRoute, useLoaderData, useNavigate, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useFormatter, useTranslations } from 'use-intl'
import { z } from 'zod'
import { featurePhotographer, listUsers, reinstate, suspend } from '@/functions/admin.functions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { useAppLocale, useErrorText } from '@/i18n/react'
import { headTranslator, privateHead } from '@/lib/seo'

const STATUSES = ['all', 'active', 'suspended'] as const

export const Route = createFileRoute('/$locale/admin/users')({
  validateSearch: z.object({ q: z.string().max(100).optional(), status: z.enum(STATUSES).optional() }),
  loaderDeps: ({ search }) => ({ q: search.q ?? '', status: search.status ?? 'all' }),
  loader: ({ deps }) => listUsers({ data: deps }),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('admin.users.title') ?? 'SOURA'),
  component: UsersPage,
})

function UsersPage() {
  const t = useTranslations('admin.users')
  const common = useTranslations('common')
  const format = useFormatter()
  const locale = useAppLocale()
  const router = useRouter()
  const navigate = useNavigate()
  const errorText = useErrorText()
  const users = Route.useLoaderData()
  const search = Route.useSearch()
  const { me } = useLoaderData({ from: '/$locale' })
  const suspendFn = useServerFn(suspend)
  const reinstateFn = useServerFn(reinstate)
  const featureFn = useServerFn(featurePhotographer)
  const [q, setQ] = useState(search.q ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id)
    setError(null)
    try {
      await fn()
      await router.invalidate()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="container-page py-10">
      <h1 className="text-display-md">{t('title')}</h1>
      <form
        className="mt-6 flex flex-wrap items-center gap-3"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          void navigate({ to: '/$locale/admin/users', params: { locale }, search: { ...search, q: q || undefined } })
        }}
      >
        <label className="sr-only" htmlFor="user-q">
          {t('search')}
        </label>
        <Input id="user-q" type="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Button type="submit" variant="secondary">
          {common('search')}
        </Button>
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <Link
              key={s}
              to="/$locale/admin/users"
              params={{ locale }}
              search={{ ...search, status: s }}
              className="chip"
              aria-current={(search.status ?? 'all') === s ? 'true' : undefined}
            >
              {t(s)}
            </Link>
          ))}
        </div>
      </form>
      {error ? <Notice kind="danger" className="mt-6">{error}</Notice> : null}
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {users.map((u) => (
          <li key={u.id} className="grid gap-3 py-4 md:grid-cols-12 md:items-center">
            <div className="md:col-span-6">
              <p className="font-semibold">
                {u.displayName || '—'}
                {u.role === 'admin' ? <span className="ms-2 text-micro text-sand">{t('admin')}</span> : null}
                {u.id === me?.id ? <span className="ms-2 text-micro text-ink-subtle">({t('you')})</span> : null}
              </p>
              <p className="text-small text-ink-muted">
                {u.email} · {u.verified ? t('verified') : t('unverified')} · {format.dateTime(new Date(u.createdAt), { dateStyle: 'medium' })}
              </p>
              {u.status === 'suspended' ? (
                <p className="text-small text-danger">
                  {u.suspendedReason === 'csam_procedure' ? t('csamHold') : `${t('suspended')} — ${u.suspendedReason ?? ''}`}
                </p>
              ) : null}
            </div>
            <p className="tabular text-small text-ink-muted md:col-span-2">{t('photos', { total: u.photos, approved: u.approved })}</p>
            <div className="flex flex-wrap gap-2 md:col-span-4 md:justify-end">
              {u.role !== 'admin' && u.status === 'active' ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    busy={busy === `f${u.id}`}
                    onClick={() => act(`f${u.id}`, () => featureFn({ data: { userId: u.id, featured: !u.featured } }))}
                  >
                    {u.featured ? t('unfeature') : t('feature')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    busy={busy === u.id}
                    onClick={() => {
                      const reason = window.prompt(t('suspendReason'))
                      if (reason && reason.trim().length >= 3) void act(u.id, () => suspendFn({ data: { userId: u.id, reason } }))
                    }}
                  >
                    {t('suspend')}
                  </Button>
                </>
              ) : null}
              {u.status === 'suspended' && u.suspendedReason !== 'csam_procedure' ? (
                <Button size="sm" variant="secondary" busy={busy === u.id} onClick={() => act(u.id, () => reinstateFn({ data: { userId: u.id } }))}>
                  {t('reinstate')}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
