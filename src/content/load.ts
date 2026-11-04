import type { Locale } from '@/i18n/config'
import type { PageContent, PageKey } from './types'

/** Loads one locale's long-form page content (split per locale by the bundler). */
export async function loadPage(locale: Locale, key: PageKey): Promise<PageContent> {
  switch (locale) {
    case 'ar':
      return (await import('./ar')).ar[key]
    case 'en':
      return (await import('./en')).en[key]
    default:
      return (await import('./fr')).fr[key]
  }
}
