import { createTranslator } from 'use-intl/core'
import { defaultLocale, isLocale, localeTags, locales, ogLocale, type Locale } from '@/i18n/config'
import type { Messages } from '@/i18n/load'

type AnyMatch = { routeId: string; loaderData?: unknown }

/** Translator usable inside a route's head() — reads messages from the /$locale match. */
export function headTranslator(matches: ReadonlyArray<AnyMatch>) {
  const m = matches.find((x) => x.routeId === '/$locale')
  const data = m?.loaderData as { locale: Locale; messages: Messages; siteUrl: string } | undefined
  if (!data) return null
  return {
    locale: data.locale,
    siteUrl: data.siteUrl,
    t: createTranslator({ locale: data.locale, messages: data.messages }),
  }
}

export type SeoInput = {
  locale: string
  siteUrl: string
  /** Path without the locale prefix, e.g. "/explore" or "" for home. */
  path: string
  title: string
  description?: string
  image?: { url: string; width: number; height: number; alt: string } | null
  type?: 'website' | 'article' | 'profile'
  noindex?: boolean
  /** Set false for pages that exist in one locale only. */
  alternates?: boolean
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>
}

export function seo(input: SeoInput) {
  const locale = isLocale(input.locale) ? input.locale : defaultLocale
  const base = input.siteUrl.replace(/\/$/, '')
  const url = `${base}/${locale}${input.path}`
  const meta: Array<Record<string, string>> = [
    { title: input.title },
    { property: 'og:title', content: input.title },
    { property: 'og:url', content: url },
    { property: 'og:site_name', content: 'SOURA' },
    { property: 'og:type', content: input.type ?? 'website' },
    { property: 'og:locale', content: ogLocale[locale] },
    { name: 'twitter:card', content: input.image ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: input.title },
  ]
  if (input.description) {
    meta.push(
      { name: 'description', content: input.description },
      { property: 'og:description', content: input.description },
      { name: 'twitter:description', content: input.description },
    )
  }
  if (input.image) {
    meta.push(
      { property: 'og:image', content: input.image.url },
      { property: 'og:image:width', content: String(input.image.width) },
      { property: 'og:image:height', content: String(input.image.height) },
      { property: 'og:image:alt', content: input.image.alt },
      { name: 'twitter:image', content: input.image.url },
    )
  }
  if (input.noindex) meta.push({ name: 'robots', content: 'noindex, nofollow' })

  const links: Array<Record<string, string>> = []
  if (!input.noindex) {
    links.push({ rel: 'canonical', href: url })
    if (input.alternates !== false) {
      for (const l of locales) {
        links.push({ rel: 'alternate', hrefLang: localeTags[l], href: `${base}/${l}${input.path}` })
      }
      links.push({ rel: 'alternate', hrefLang: 'x-default', href: `${base}/${defaultLocale}${input.path}` })
    }
  }
  const scripts = input.jsonLd
    ? [{ type: 'application/ld+json', children: JSON.stringify(input.jsonLd).replace(/</g, '\\u003c') }]
    : []
  return { meta, links, scripts }
}

/** Head for private pages (auth, dashboard, admin): title only, never indexed. */
export function privateHead(title: string) {
  return { meta: [{ title }, { name: 'robots', content: 'noindex, nofollow' }] }
}
