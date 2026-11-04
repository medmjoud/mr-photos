import { useLoaderData } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'

/** Shown on every page while demo content exists, so it can never pass for real work. */
export function DemoBanner() {
  const { hasDemo } = useLoaderData({ from: '/$locale' })
  const t = useTranslations('common')
  if (!hasDemo) return null
  return (
    <div className="bg-warn px-4 py-1.5 text-center text-micro font-semibold text-bg" role="note">
      {t('demoNotice')}
    </div>
  )
}
