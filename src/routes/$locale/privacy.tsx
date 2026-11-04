import { createFileRoute } from '@tanstack/react-router'
import { EditorialPage } from '@/components/layout/EditorialPage'
import { loadPage } from '@/content/load'
import { isLocale } from '@/i18n/config'
import { seo, headTranslator  } from '@/lib/seo'

export const Route = createFileRoute('/$locale/privacy')({
  loader: ({ params }) => loadPage(isLocale(params.locale) ? params.locale : 'fr', 'privacy'),
  head: ({ matches, params, loaderData }) => {
    const h = headTranslator(matches)
    if (!h || !loaderData) return {}
    return seo({
      locale: params.locale,
      siteUrl: h.siteUrl,
      path: '/privacy',
      title: `${loaderData.title} · SOURA`,
      description: loaderData.lead,
    })
  },
  component: () => <EditorialPage content={Route.useLoaderData()} />,
})
