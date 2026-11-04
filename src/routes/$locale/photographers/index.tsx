import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { listPhotographers } from '@/functions/public.functions'
import { Avatar } from '@/components/photo/Avatar'
import { Photo } from '@/components/photo/Photo'
import { EmptyState, PageIntro } from '@/components/ui/Editorial'
import { Icon } from '@/components/ui/Icon'
import { useAppLocale } from '@/i18n/react'
import { isLocale } from '@/i18n/config'
import { regionName } from '@/lib/regions'
import { headTranslator, seo } from '@/lib/seo'

export const Route = createFileRoute('/$locale/photographers/')({
  loader: ({ params }) => listPhotographers({ data: { locale: isLocale(params.locale) ? params.locale : 'fr' } }),
  head: ({ matches, params }) => {
    const h = headTranslator(matches)
    if (!h) return {}
    return seo({
      locale: params.locale,
      siteUrl: h.siteUrl,
      path: '/photographers',
      title: `${h.t('photographers.title')} · SOURA`,
      description: h.t('photographers.lead'),
    })
  },
  component: PhotographersPage,
})

function PhotographersPage() {
  const t = useTranslations('photographers')
  const common = useTranslations('common')
  const locale = useAppLocale()
  const list = Route.useLoaderData()

  return (
    <>
      <PageIntro eyebrow={t('title')} title={t('title')} lead={t('lead')} />
      <section className="container-page pb-24">
        {list.length === 0 ? (
          <EmptyState
            title={t('emptyTitle')}
            body={t('emptyBody')}
            action={
              <Link to="/$locale/for-photographers" params={{ locale }} className="btn btn-primary">
                {t('cta')}
              </Link>
            }
          />
        ) : (
          <ol className="divide-y divide-line border-y border-line">
            {list.map((p, i) => (
              <li key={p.slug}>
                <Link
                  to="/$locale/photographers/$slug"
                  params={{ locale, slug: p.slug }}
                  className="group grid items-center gap-6 py-8 md:grid-cols-12"
                >
                  <span className="tabular hidden font-display text-title text-ink-subtle md:col-span-1 md:block">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex items-center gap-4 md:col-span-5">
                    <Avatar avatar={p.avatar} name={p.displayName} size={64} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span dir="auto" className="font-display text-display-md group-hover:text-accent-text">
                          {p.displayName}
                        </span>
                        {p.featured ? <span className="eyebrow">{t('featured')}</span> : null}
                        {p.isDemo ? <span className="rounded-pill bg-warn px-2 py-0.5 text-micro font-bold text-bg">{common('demo')}</span> : null}
                      </p>
                      <p className="mt-1 text-small text-ink-muted">
                        {[p.city, regionName(p.regionSlug, locale)].filter(Boolean).join(', ')}
                        {p.city || p.regionSlug ? ' · ' : ''}
                        <span className="tabular">{t('count', { count: p.count })}</span>
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:col-span-5">
                    {p.samples.map((s) => (
                      <Photo
                        key={s.id}
                        src={s.thumb}
                        alt={s.alt}
                        width={1}
                        height={1}
                        blur={s.blur}
                        sizes="(min-width: 56rem) 14vw, 30vw"
                        className="img-zoom aspect-square"
                      />
                    ))}
                  </div>
                  <Icon name="arrowRight" className="hidden justify-self-end text-ink-subtle group-hover:text-ink md:col-span-1 md:block rtl:rotate-180" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  )
}
