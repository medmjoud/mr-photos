import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { exploreSearchSchema, explorePhotos } from '@/functions/public.functions'
import { Masonry } from '@/components/photo/PhotoTile'
import { EmptyState, Eyebrow } from '@/components/ui/Editorial'
import { Icon } from '@/components/ui/Icon'
import { Input, Select } from '@/components/ui/Field'
import { useAppLocale } from '@/i18n/react'
import { categories, orientations } from '@/lib/categories'
import { getRegion, regions } from '@/lib/regions'
import { headTranslator, seo } from '@/lib/seo'
import { isLocale } from '@/i18n/config'

export const Route = createFileRoute('/$locale/explore')({
  validateSearch: exploreSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps, params }) => explorePhotos({ data: { ...deps, locale: isLocale(params.locale) ? params.locale : 'fr' } }),
  head: ({ matches, params, loaderData, match }) => {
    const h = headTranslator(matches)
    if (!h) return {}
    const search = match.search as { q?: string; region?: string; category?: string; page?: number }
    const region = getRegion(search.region)
    const title = region ? `${region.name[h.locale]} — ${h.t('explore.title')} · SOURA` : `${h.t('explore.title')} · SOURA`
    const qs = new URLSearchParams()
    if (search.region) qs.set('region', search.region)
    if (search.category) qs.set('category', search.category)
    const first = loaderData?.items[0]
    return seo({
      locale: params.locale,
      siteUrl: h.siteUrl,
      path: `/explore${qs.size ? `?${qs.toString()}` : ''}`,
      title,
      description: region ? region.blurb[h.locale] : h.t('explore.lead'),
      image: first?.og ? { url: new URL(first.og, h.siteUrl).toString(), width: 1200, height: 630, alt: first.alt } : null,
      // Free-text search result pages and deep pagination are not indexed.
      noindex: Boolean(search.q) || (search.page ?? 1) > 1,
    })
  },
  component: Explore,
})

function Explore() {
  const t = useTranslations('explore')
  const common = useTranslations('common')
  const locale = useAppLocale()
  const navigate = useNavigate()
  const search = Route.useSearch()
  const data = Route.useLoaderData()
  const [q, setQ] = useState(search.q ?? '')
  const region = getRegion(search.region)
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const filtered = Boolean(search.q || search.region || search.category || search.orientation || search.photographer)

  function go(next: Partial<typeof search>) {
    void navigate({
      to: '/$locale/explore',
      params: { locale },
      search: { ...search, ...next, page: undefined },
      resetScroll: false,
    })
  }

  return (
    <>
      <header className="container-page pt-12 pb-8 md:pt-16">
        <Eyebrow>{t('title')}</Eyebrow>
        <h1 className="mt-4 max-w-[16ch] text-display-xl">
          {region ? region.name[locale] : data.photographer ? t('byPhotographer', { name: data.photographer.displayName }) : t('title')}
        </h1>
        <p className="mt-5 max-w-[56ch] text-body-lg text-ink-muted">{region ? region.blurb[locale] : t('lead')}</p>
      </header>

      <div className="sticky top-16 z-30 border-y border-line bg-bg">
        <form
          role="search"
          method="get"
          action={`/${locale}/explore`}
          className="container-page grid grid-cols-2 gap-3 py-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]"
          onSubmit={(e) => {
            e.preventDefault()
            go({ q: q.trim() || undefined })
          }}
        >
          <div className="relative col-span-2 md:col-span-1">
            <label htmlFor="explore-q" className="sr-only">
              {t('searchLabel')}
            </label>
            <Icon name="search" size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <Input
              id="explore-q"
              name="q"
              type="search"
              enterKeyHint="search"
              placeholder={t('searchPlaceholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="ps-10"
            />
          </div>
          <label className="sr-only" htmlFor="explore-region">
            {t('region')}
          </label>
          <Select id="explore-region" name="region" value={search.region ?? ''} onChange={(e) => go({ region: (e.target.value || undefined) })}>
            <option value="">{t('allRegions')}</option>
            {regions.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name[locale]}
              </option>
            ))}
          </Select>
          <label className="sr-only" htmlFor="explore-category">
            {t('category')}
          </label>
          <Select id="explore-category" name="category" value={search.category ?? ''} onChange={(e) => go({ category: (e.target.value || undefined) })}>
            <option value="">{t('allCategories')}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name[locale]}
              </option>
            ))}
          </Select>
          <label className="sr-only" htmlFor="explore-orientation">
            {t('orientation')}
          </label>
          <Select
            id="explore-orientation"
            name="orientation"
            value={search.orientation ?? ''}
            onChange={(e) => go({ orientation: (e.target.value || undefined) as never })}
          >
            <option value="">{t('allOrientations')}</option>
            {orientations.map((o) => (
              <option key={o} value={o}>
                {t(`orientations.${o}`)}
              </option>
            ))}
          </Select>
          {search.photographer ? <input type="hidden" name="photographer" value={search.photographer} /> : null}
          <button type="submit" className="btn btn-primary">
            {t('apply')}
          </button>
        </form>
      </div>

      <section className="container-page pt-8 pb-24" aria-live="polite">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-small text-ink-muted">{t('results', { count: data.total })}</p>
          {filtered ? (
            <Link to="/$locale/explore" params={{ locale }} className="link text-small">
              {t('clear')}
            </Link>
          ) : null}
        </div>

        {data.items.length === 0 ? (
          filtered ? (
            <EmptyState title={t('emptyTitle')} body={t('emptyBody')} action={<Link to="/$locale/explore" params={{ locale }} className="btn btn-secondary">{t('clear')}</Link>} />
          ) : (
            <EmptyState
              title={t('launchTitle')}
              body={t('launchBody')}
              action={
                <Link to="/$locale/for-photographers" params={{ locale }} className="btn btn-primary">
                  {t('launchCta')}
                </Link>
              }
            />
          )
        ) : (
          <Masonry photos={data.items} priorityCount={2} />
        )}

        {pages > 1 ? (
          <nav aria-label={t('pagination')} className="mt-12 flex items-center justify-between border-t border-line pt-6">
            {data.page > 1 ? (
              <Link to="/$locale/explore" params={{ locale }} search={{ ...search, page: data.page - 1 }} className="btn btn-secondary btn-sm" rel="prev">
                <Icon name="arrowLeft" size={16} className="rtl:rotate-180" />
                {common('previous')}
              </Link>
            ) : (
              <span />
            )}
            <span className="tabular text-small text-ink-muted">{t('pageOf', { page: data.page, pages })}</span>
            {data.page < pages ? (
              <Link to="/$locale/explore" params={{ locale }} search={{ ...search, page: data.page + 1 }} className="btn btn-secondary btn-sm" rel="next">
                {common('next')}
                <Icon name="arrowRight" size={16} className="rtl:rotate-180" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </>
  )
}
