import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { getHome } from '@/functions/public.functions'
import { Photo } from '@/components/photo/Photo'
import { Masonry, PhotoTile } from '@/components/photo/PhotoTile'
import { Avatar } from '@/components/photo/Avatar'
import { RegionMap } from '@/components/map/RegionMap'
import { EmptyState, SectionHeader } from '@/components/ui/Editorial'
import { Icon } from '@/components/ui/Icon'
import { useAppLocale } from '@/i18n/react'
import { isLocale } from '@/i18n/config'
import { categories } from '@/lib/categories'
import { MAP_PATHS, MAP_VIEWBOX } from '@/lib/map-paths'
import { regionName } from '@/lib/regions'
import { headTranslator, seo } from '@/lib/seo'

export const Route = createFileRoute('/$locale/')({
  loader: ({ params }) => getHome({ data: { locale: isLocale(params.locale) ? params.locale : 'fr' } }),
  head: ({ matches, params, loaderData }) => {
    const h = headTranslator(matches)
    if (!h) return {}
    const hero = loaderData?.featured[0]
    return seo({
      locale: params.locale,
      siteUrl: h.siteUrl,
      path: '',
      title: `SOURA — ${h.t('meta.tagline')}`,
      description: h.t('meta.description'),
      image: hero?.og ? { url: new URL(hero.og, h.siteUrl).toString(), width: 1200, height: 630, alt: hero.alt } : null,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'SOURA',
        alternateName: 'صورة',
        url: `${h.siteUrl}/${params.locale}`,
        inLanguage: params.locale,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${h.siteUrl}/${params.locale}/explore?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    })
  },
  component: Home,
})

function Home() {
  const t = useTranslations('home')
  const meta = useTranslations('meta')
  const locale = useAppLocale()
  const data = Route.useLoaderData()
  const [hero, ...rest] = data.featured
  const hasPhotos = data.featured.length > 0

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="container-page grid gap-8 pt-10 pb-12 md:pt-14 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-12 lg:gap-10 lg:pb-14">
          <div className="flex flex-col justify-end lg:col-span-5 lg:pb-6">
            <p className="eyebrow">{t('eyebrow')}</p>
            <h1 className="mt-5 text-display-2xl">{meta('tagline')}</h1>
            <p className="mt-6 max-w-[40ch] text-body-lg text-ink-muted">{t('lead')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/$locale/explore" params={{ locale }} className="btn btn-primary btn-lg">
                {t('ctaExplore')}
                <Icon name="arrowRight" size={18} className="rtl:rotate-180" />
              </Link>
              <Link to="/$locale/for-photographers" params={{ locale }} className="btn btn-secondary btn-lg">
                {t('ctaJoin')}
              </Link>
            </div>
            <p className="tabular mt-8 text-small text-ink-subtle">
              {t('stats', { photos: data.totals.photos, photographers: data.totals.photographers, regions: data.totals.regions })}
            </p>
          </div>
          <div className="relative lg:col-span-7">
            {hero ? (
              <figure className="flex h-full flex-col">
                <Link
                  to="/$locale/photos/$slug"
                  params={{ locale, slug: hero.segment }}
                  className="group relative block flex-1 overflow-hidden"
                >
                  <Photo
                    src={hero.thumb}
                    alt={hero.alt}
                    width={hero.width}
                    height={hero.height}
                    blur={hero.blur}
                    sizes="(min-width: 64rem) 58vw, 100vw"
                    priority
                    className="hero-photo img-zoom h-full max-h-[78svh] w-full lg:absolute lg:inset-0 lg:max-h-none"
                    transitionName={`photo-${hero.id}`}
                  />
                </Link>
                <figcaption className="mt-3 text-small text-ink-subtle">
                  {t('heroCredit', {
                    author: hero.authorName,
                    place: [hero.locationText, regionName(hero.regionSlug, locale)].filter(Boolean).join(', '),
                  })}
                </figcaption>
              </figure>
            ) : (
              <HeroMapGraphic />
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ principles */}
      <section className="container-page section" data-reveal>
        <SectionHeader index="01" eyebrow={t('principlesEyebrow')} title={t('principlesTitle')} />
        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-0">
          {(['1', '2', '3'] as const).map((n, i) => (
            <li key={n} className={i ? 'md:border-s md:border-line md:ps-8' : 'md:pe-8'}>
              <span className="tabular font-display text-display-md text-sand">0{n}</span>
              <h3 className="mt-4 font-sans text-title font-semibold">{t(`p${n}Title`)}</h3>
              <p className="mt-3 max-w-[36ch] text-ink-muted">{t(`p${n}Body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* -------------------------------------------------------- featured */}
      <section className="container-page pb-[var(--section)]" data-reveal>
        <SectionHeader
          index="02"
          eyebrow={t('featuredEyebrow')}
          title={t('featuredTitle')}
          aside={
            hasPhotos ? (
              <Link to="/$locale/explore" params={{ locale }} className="link inline-flex items-center gap-2">
                {t('seeAll')}
                <Icon name="arrowRight" size={16} className="rtl:rotate-180" />
              </Link>
            ) : null
          }
        />
        <div className="mt-12">
          {!hasPhotos ? (
            <EmptyState
              title={t('launchTitle')}
              body={t('launchBody')}
              action={
                <Link to="/$locale/for-photographers" params={{ locale }} className="btn btn-primary">
                  {t('ctaJoin')}
                </Link>
              }
            />
          ) : rest.length >= 2 ? (
            <div className="grid gap-4 md:grid-cols-12">
              <div className="md:col-span-7">
                <PhotoTile photo={rest[0]} sizes="(min-width: 48rem) 58vw, 100vw" />
              </div>
              <div className="flex flex-col gap-4 md:col-span-5 md:pt-24">
                {rest.slice(1, 3).map((p) => (
                  <PhotoTile key={p.id} photo={p} sizes="(min-width: 48rem) 40vw, 100vw" />
                ))}
              </div>
              {rest.length > 3 ? (
                <div className="mt-4 md:col-span-12">
                  <Masonry photos={rest.slice(3, 7)} />
                </div>
              ) : null}
            </div>
          ) : (
            <Masonry photos={data.featured} />
          )}
        </div>
      </section>

      {/* --------------------------------------------------------- regions */}
      <section id="regions" className="border-y border-line bg-bg-raised" data-reveal>
        <div className="container-page section">
          <SectionHeader index="03" eyebrow={t('regionsEyebrow')} title={t('regionsTitle')} aside={<p>{t('regionsLead')}</p>} />
          <div className="mt-14">
            <RegionMap counts={data.regionCounts} samples={data.regionSamples} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ categories */}
      <section className="container-page section" data-reveal>
        <SectionHeader index="04" eyebrow={t('categoriesEyebrow')} title={t('categoriesTitle')} />
        <ul className="mt-12 flex flex-wrap gap-x-10 gap-y-5">
          {categories.map((c) => {
            const n = data.categoryCounts[c.slug] ?? 0
            return (
              <li key={c.slug}>
                <Link
                  to="/$locale/explore"
                  params={{ locale }}
                  search={{ category: c.slug }}
                  className="group inline-flex items-start gap-2 font-display text-display-md transition-colors hover:text-accent-text"
                >
                  <span className={n ? undefined : 'text-ink-muted'}>{c.name[locale]}</span>
                  <sup className="tabular mt-2 font-sans text-micro text-ink-subtle">{n}</sup>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {/* --------------------------------------------------- photographers */}
      {data.photographers.length ? (
        <section className="container-page pb-[var(--section)]" data-reveal>
          <SectionHeader index="05" eyebrow={t('photographersEyebrow')} title={t('photographersTitle')} />
          <ul className="mt-12 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {data.photographers.map((p) => (
              <li key={p.slug} className="bg-bg">
                <Link to="/$locale/photographers/$slug" params={{ locale, slug: p.slug }} className="group flex h-full flex-col gap-4 p-6">
                  <Avatar avatar={p.avatar} name={p.displayName} size={72} />
                  <span className="font-display text-title group-hover:text-accent-text">{p.displayName}</span>
                  <span className="text-small text-ink-muted">
                    {[p.city, regionName(p.regionSlug, locale)].filter(Boolean).join(', ')}
                  </span>
                  {p.bio ? <span className="line-clamp-3 text-small text-ink-subtle">{p.bio}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------------------ join */}
      <section className="border-t border-line bg-surface" data-reveal>
        <div className="container-page grid gap-10 py-[var(--section)] md:grid-cols-12">
          <div className="md:col-span-8">
            <p className="eyebrow">{t('joinEyebrow')}</p>
            <h2 className="mt-5 text-display-xl">{t('joinTitle')}</h2>
          </div>
          <div className="flex flex-col justify-end gap-6 md:col-span-4">
            <p className="text-body-lg text-ink-muted">{t('joinBody')}</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/$locale/auth/signup" params={{ locale }} className="btn btn-primary btn-lg">
                {t('joinCta')}
              </Link>
              <Link to="/$locale/for-photographers" params={{ locale }} className="btn btn-ghost btn-lg">
                {t('joinSecondary')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

/** Shown before the first photo is published: the country drawn as hairlines, not a placeholder. */
function HeroMapGraphic() {
  return (
    <svg viewBox={MAP_VIEWBOX} className="mx-auto h-full max-h-[70svh] w-full" aria-hidden="true">
      {Object.entries(MAP_PATHS).map(([slug, p], i) => (
        <path
          key={slug}
          d={p.d}
          className="hero-line fill-none stroke-sand"
          strokeWidth={1.2}
          style={{ animationDelay: `${i * 90}ms`, opacity: 0.85 }}
        />
      ))}
      {MAP_PATHS.nouakchott ? <circle cx={MAP_PATHS.nouakchott.cx} cy={MAP_PATHS.nouakchott.cy} r={7} className="fill-accent" /> : null}
    </svg>
  )
}
