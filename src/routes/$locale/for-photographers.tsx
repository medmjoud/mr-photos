import { createFileRoute, Link  } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { useAppLocale } from '@/i18n/react'
import { EditorialPage } from '@/components/layout/EditorialPage'
import { loadPage } from '@/content/load'
import { isLocale } from '@/i18n/config'
import { seo, headTranslator  } from '@/lib/seo'

export const Route = createFileRoute('/$locale/for-photographers')({
  loader: ({ params }) => loadPage(isLocale(params.locale) ? params.locale : 'fr', 'forPhotographers'),
  head: ({ matches, params, loaderData }) => {
    const h = headTranslator(matches)
    if (!h || !loaderData) return {}
    return seo({
      locale: params.locale,
      siteUrl: h.siteUrl,
      path: '/for-photographers',
      title: `${loaderData.title} · SOURA`,
      description: loaderData.lead,
    })
  },
  component: () => <EditorialPage content={Route.useLoaderData()}><Cta /></EditorialPage>,
})

function Cta() {
  const t = useTranslations('home')
  const locale = useAppLocale()
  return (
    <div className="not-prose mt-14 flex flex-wrap gap-3 border-t border-line pt-10">
      <Link to="/$locale/auth/signup" params={{ locale }} className="btn btn-primary btn-lg">
        {t('joinCta')}
      </Link>
      <Link to="/$locale/content-rules" params={{ locale }} className="btn btn-secondary btn-lg">
        {t('joinSecondary')}
      </Link>
    </div>
  )
}
