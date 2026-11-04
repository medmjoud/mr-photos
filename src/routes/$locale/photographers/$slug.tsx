import { Link, createFileRoute } from '@tanstack/react-router'
import { useFormatter, useTranslations } from 'use-intl'
import { getPhotographer } from '@/functions/public.functions'
import { Masonry } from '@/components/photo/PhotoTile'
import { ContactPanel } from '@/components/photo/ContactPanel'
import { Avatar } from '@/components/photo/Avatar'
import { useTrackView } from '@/components/photo/useTrackView'
import { Eyebrow } from '@/components/ui/Editorial'
import { Icon } from '@/components/ui/Icon'
import { useAppLocale } from '@/i18n/react'
import { isLocale } from '@/i18n/config'
import { regionName } from '@/lib/regions'
import { headTranslator, seo } from '@/lib/seo'

export const Route = createFileRoute('/$locale/photographers/$slug')({
  loader: ({ params }) => getPhotographer({ data: { slug: params.slug, locale: isLocale(params.locale) ? params.locale : 'fr' } }),
  head: ({ matches, params, loaderData }) => {
    const h = headTranslator(matches)
    if (!h || !loaderData) return {}
    const first = loaderData.photos[0]
    const url = `${h.siteUrl}/${params.locale}/photographers/${loaderData.slug}`
    return seo({
      locale: params.locale,
      siteUrl: h.siteUrl,
      path: `/photographers/${loaderData.slug}`,
      title: `${loaderData.displayName} — ${h.t('photographers.title')} · SOURA`,
      description: loaderData.bio.slice(0, 160) || h.t('photographers.lead'),
      type: 'profile',
      image: first?.og ? { url: new URL(first.og, h.siteUrl).toString(), width: 1200, height: 630, alt: first.alt } : null,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        url,
        mainEntity: {
          '@type': 'Person',
          name: loaderData.displayName,
          description: loaderData.bio || undefined,
          jobTitle: 'Photographer',
          homeLocation: loaderData.city ? { '@type': 'Place', name: loaderData.city } : undefined,
          sameAs: [loaderData.website, loaderData.instagram ? `https://instagram.com/${loaderData.instagram}` : ''].filter(Boolean),
        },
      },
    })
  },
  component: PhotographerPage,
})

function PhotographerPage() {
  const t = useTranslations('photographers')
  const contactT = useTranslations('contact')
  const explore = useTranslations('explore')
  const common = useTranslations('common')
  const format = useFormatter()
  const locale = useAppLocale()
  const p = Route.useLoaderData()
  useTrackView({ profileSlug: p.slug })
  const place = [p.city, regionName(p.regionSlug, locale)].filter(Boolean).join(', ')

  return (
    <>
      <header className="container-page grid gap-10 pt-12 pb-12 md:pt-20 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Avatar avatar={p.avatar} name={p.displayName} size={112} />
          <Eyebrow className="mt-8">{t('portfolio')}</Eyebrow>
          <h1 className="mt-3 text-display-xl">{p.displayName}</h1>
          {p.isDemo ? <span className="mt-3 inline-block rounded-pill bg-warn px-2.5 py-0.5 text-micro font-bold text-black">{common('demo')}</span> : null}
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-muted">
            {place ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="pin" size={16} />
                {place}
              </span>
            ) : null}
            <span>{t('since', { date: format.dateTime(new Date(p.since), { month: 'long', year: 'numeric' }) })}</span>
            <span className="tabular">{t('count', { count: p.photos.length })}</span>
          </p>
          {p.bio ? <p className="mt-8 max-w-[60ch] text-body-lg whitespace-pre-line text-ink-muted">{p.bio}</p> : null}
          {p.website || p.instagram ? (
            <ul className="mt-6 flex flex-wrap gap-4 text-small">
              {p.website ? (
                <li>
                  <a href={p.website} className="link inline-flex items-center gap-1.5" target="_blank" rel="nofollow noopener noreferrer ugc">
                    {t('website')}
                    <Icon name="external" size={14} />
                  </a>
                </li>
              ) : null}
              {p.instagram ? (
                <li>
                  <a
                    href={`https://instagram.com/${p.instagram}`}
                    className="link inline-flex items-center gap-1.5"
                    target="_blank"
                    rel="nofollow noopener noreferrer ugc"
                  >
                    {t('instagram')} · @{p.instagram}
                    <Icon name="external" size={14} />
                  </a>
                </li>
              ) : null}
            </ul>
          ) : null}
          {p.regionsCovered.length ? (
            <div className="mt-8">
              <p className="eyebrow">{t('regions')}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {p.regionsCovered.map((r) => (
                  <li key={r}>
                    <Link
                      to="/$locale/explore"
                      params={{ locale }}
                      search={{ region: r, photographer: p.slug }}
                      className="chip"
                      aria-label={`${regionName(r, locale)} — ${explore('byPhotographer', { name: p.displayName })}`}
                    >
                      {regionName(r, locale)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <aside className="lg:col-span-4 lg:col-start-9" aria-labelledby="contact-title">
          <div className="border-t border-line pt-6 lg:border-t-0 lg:pt-2">
            <h2 id="contact-title" className="text-title">
              {contactT('title', { name: p.displayName })}
            </h2>
            <div className="mt-4">
              <ContactPanel slug={p.slug} name={p.displayName} contact={p.contact} />
            </div>
          </div>
        </aside>
      </header>
      <section className="container-page pb-24" aria-label={t('portfolio')}>
        <Masonry photos={p.photos} priorityCount={2} />
      </section>
    </>
  )
}
