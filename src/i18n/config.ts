export const locales = ['fr', 'ar', 'en'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'fr'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as ReadonlyArray<string>).includes(value)
}

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

/** BCP-47 tags used for hreflang, Open Graph and Intl formatting. */
export const localeTags: Record<Locale, string> = {
  fr: 'fr-MR',
  ar: 'ar-MR',
  en: 'en',
}

export const ogLocale: Record<Locale, string> = {
  fr: 'fr_FR',
  ar: 'ar_AR',
  en: 'en_US',
}

/** Native language names, shown in the language switcher. */
export const localeNames: Record<Locale, string> = {
  fr: 'Français',
  ar: 'العربية',
  en: 'English',
}

/**
 * Picks the best supported locale from an Accept-Language header.
 * Used only for the bare "/" redirect; no cookie is stored.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.find((p) => p.trim().startsWith('q='))
      return { tag: (tag ?? '').toLowerCase(), q: q ? Number(q.trim().slice(2)) || 0 : 1 }
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q)
  for (const { tag } of ranked) {
    const base = tag.split('-')[0]
    if (isLocale(base)) return base
  }
  return defaultLocale
}
