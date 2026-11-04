import { createFileRoute } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { headTranslator, seo } from '@/lib/seo'

// Temporary home — the editorial home page is built in Phase 4.
export const Route = createFileRoute('/$locale/')({
  head: ({ matches, params }) => {
    const h = headTranslator(matches)
    if (!h) return {}
    return seo({
      locale: params.locale,
      siteUrl: h.siteUrl,
      path: '',
      title: `SOURA — ${h.t('meta.tagline')}`,
      description: h.t('meta.description'),
    })
  },
  component: Home,
})

function Home() {
  const t = useTranslations('meta')
  return (
    <section className="container-page section">
      <h1 className="max-w-[14ch] text-display-2xl">{t('tagline')}</h1>
      <p className="mt-8 max-w-[52ch] text-body-lg text-ink-muted">{t('description')}</p>
    </section>
  )
}
