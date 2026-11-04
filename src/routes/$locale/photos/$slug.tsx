import { Link, createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { getPhoto } from '@/functions/public.functions'
import { Photo } from '@/components/photo/Photo'
import { Masonry } from '@/components/photo/PhotoTile'
import { ContactPanel } from '@/components/photo/ContactPanel'
import { ReportButton } from '@/components/photo/ReportDialog'
import { useTrackView } from '@/components/photo/useTrackView'
import { Avatar } from '@/components/photo/Avatar'
import { Eyebrow } from '@/components/ui/Editorial'
import { Icon } from '@/components/ui/Icon'
import { useAppLocale } from '@/i18n/react'
import { isLocale } from '@/i18n/config'
import { categoryName } from '@/lib/categories'
import { regionName } from '@/lib/regions'
import { headTranslator, seo } from '@/lib/seo'
import { idFromSegment } from '@/lib/text'

export const Route = createFileRoute('/$locale/photos/$slug')({
  loader: async ({ params }) => {
    const id = idFromSegment(params.slug)
    if (!id) throw notFound()
    const data = await getPhoto({ data: { id, locale: isLocale(params.locale) ? params.locale : 'fr' } })
    // Canonical slug (titles can change; the id is what counts).
    if (data.photo.segment !== params.slug) {
      throw redirect({ to: '/$locale/photos/$slug', params: { locale: params.locale, slug: data.photo.segment }, statusCode: 301 })
    }
    return data
  },
  head: ({ matches, params, loaderData }) => {
    const h = headTranslator(matches)
    if (!h || !loaderData) return {}
    const { photo, photographer } = loaderData
    const url = `${h.siteUrl}/${params.locale}/photos/${photo.segment}`
    const profileUrl = `${h.siteUrl}/${params.locale}/photographers/${photographer.slug}`
    const og = photo.og ? new URL(photo.og, h.siteUrl).toString() : undefined
    const region = regionName(photo.regionSlug, h.locale)
    return seo({
      locale: params.locale,
      siteUrl: h.siteUrl,
      path: `/photos/${photo.segment}`,
      title: `${photo.title} — ${photo.authorName} · SOURA`,
      description: photo.description.slice(0, 160) || `${photo.title}, ${region}. ${h.t('photo.by', { name: photo.authorName })}.`,
      type: 'article',
      image: og ? { url: og, width: 1200, height: 630, alt: photo.alt } : null,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ImageObject',
        name: photo.title,
        description: photo.description || photo.alt,
        contentUrl: og,
        thumbnailUrl: og,
        url,
        width: photo.width,
        height: photo.height,
        dateCreated: String(photo.yearTaken),
        datePublished: photo.approvedAt ?? undefined,
        creator: { '@type': 'Person', name: photo.authorName, url: profileUrl },
        creditText: photo.authorName,
        copyrightNotice: `© ${photo.authorName}`,
        copyrightHolder: { '@type': 'Person', name: photo.authorName },
        license: `${url}#rights`,
        acquireLicensePage: profileUrl,
        contentLocation: {
          '@type': 'Place',
          name: photo.locationText || region,
          address: { '@type': 'PostalAddress', addressRegion: region, addressCountry: 'MR' },
        },
        keywords: photo.tags.join(', ') || undefined,
      },
    })
  },
  component: PhotoPage,
})

function PhotoPage() {
  const t = useTranslations('photo')
  const contactT = useTranslations('contact')
  const common = useTranslations('common')
  const locale = useAppLocale()
  const { photo, photographer, related } = Route.useLoaderData()
  useTrackView({ photoId: photo.id })
  const size = photo.previewSize ?? { width: photo.width, height: photo.height }

  return (
    <article>
      <div className="bg-bg-raised">
        <div className="mx-auto flex max-w-[110rem] justify-center px-0 py-4 sm:px-[var(--gutter)] sm:py-8">
          <Photo
            src={photo.preview}
            alt={photo.alt}
            width={size.width}
            height={size.height}
            blur={photo.blur}
            sizes="(min-width: 110rem) 1600px, 100vw"
            priority
            fit="contain"
            className="max-h-[82dvh] w-auto max-w-full bg-transparent!"
            imgClassName="max-h-[82dvh]"
            transitionName={`photo-${photo.id}`}
          />
        </div>
        <p className="container-page pb-4 text-center text-micro text-ink-subtle">{t('previewNote')}</p>
      </div>

      <div className="container-page grid gap-12 py-12 md:py-16 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {photo.isDemo ? (
            <span className="mb-4 inline-block rounded-pill bg-warn px-2.5 py-0.5 text-micro font-bold text-black">{common('demo')}</span>
          ) : null}
          <h1 className="text-display-lg">{photo.title}</h1>
          <Link
            to="/$locale/photographers/$slug"
            params={{ locale, slug: photographer.slug }}
            className="group mt-6 inline-flex items-center gap-3"
          >
            <Avatar avatar={photographer.avatar} name={photographer.displayName} size={44} />
            <span>
              <span className="block font-semibold group-hover:text-accent-text">{t('by', { name: photo.authorName })}</span>
              <span className="block text-small text-ink-muted">{t('seeProfile')}</span>
            </span>
          </Link>
          {photo.description ? <p className="mt-8 max-w-[62ch] text-body-lg whitespace-pre-line text-ink-muted">{photo.description}</p> : null}
          {photo.tags.length ? (
            <ul className="mt-8 flex flex-wrap gap-2" aria-label={t('tags')}>
              {photo.tags.map((tag) => (
                <li key={tag}>
                  <Link to="/$locale/explore" params={{ locale }} search={{ q: tag }} className="chip">
                    #{tag}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-8 sm:grid-cols-4">
            <div>
              <dt className="eyebrow">{t('region')}</dt>
              <dd className="mt-1">
                <Link to="/$locale/explore" params={{ locale }} search={{ region: photo.regionSlug }} className="link">
                  {regionName(photo.regionSlug, locale)}
                </Link>
              </dd>
            </div>
            {photo.locationText ? (
              <div>
                <dt className="eyebrow">{t('place')}</dt>
                <dd className="mt-1">{photo.locationText}</dd>
              </div>
            ) : null}
            <div>
              <dt className="eyebrow">{t('year')}</dt>
              <dd className="tabular mt-1">{photo.yearTaken}</dd>
            </div>
            <div>
              <dt className="eyebrow">{t('category')}</dt>
              <dd className="mt-1">
                <Link to="/$locale/explore" params={{ locale }} search={{ category: photo.category }} className="link">
                  {categoryName(photo.category, locale)}
                </Link>
              </dd>
            </div>
          </dl>

          <section id="rights" className="mt-10 border-s-2 border-sand ps-5">
            <h2 className="eyebrow font-sans">{t('rightsTitle')}</h2>
            <p className="mt-2 max-w-[62ch] text-small text-ink-muted">{t('rights', { author: photo.authorName })}</p>
          </section>
        </div>

        <aside className="lg:col-span-4 lg:col-start-9" aria-labelledby="contact-title">
          <div className="lg:sticky lg:top-24">
            <h2 id="contact-title" className="flex items-center gap-2 text-title">
              <Icon name="message" size={20} className="text-sand" />
              {contactT('title', { name: photographer.displayName })}
            </h2>
            <div className="mt-4">
              <ContactPanel slug={photographer.slug} name={photographer.displayName} photoId={photo.id} contact={photographer.contact} />
            </div>
            <div className="mt-8 border-t border-line pt-4">
              <ReportButton photoId={photo.id} />
            </div>
          </div>
        </aside>
      </div>

      {related.length ? (
        <section className="container-page border-t border-line pt-12 pb-24" aria-labelledby="related">
          <Eyebrow>{regionName(photo.regionSlug, locale)}</Eyebrow>
          <h2 id="related" className="mt-3 mb-8 text-display-md">
            {t('related')}
          </h2>
          <Masonry photos={related} />
        </section>
      ) : null}
    </article>
  )
}
