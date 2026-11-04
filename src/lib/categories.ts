import type { Locale } from '@/i18n/config'

export type Category = {
  slug: string
  name: Record<Locale, string>
}

export const categories: ReadonlyArray<Category> = [
  { slug: 'landscapes', name: { fr: 'Paysages', ar: 'مناظر طبيعية', en: 'Landscapes' } },
  { slug: 'people', name: { fr: 'Portraits', ar: 'بورتريهات', en: 'Portraits' } },
  { slug: 'daily-life', name: { fr: 'Vie quotidienne', ar: 'الحياة اليومية', en: 'Daily life' } },
  { slug: 'culture', name: { fr: 'Culture & traditions', ar: 'ثقافة وتقاليد', en: 'Culture & traditions' } },
  { slug: 'architecture', name: { fr: 'Architecture & patrimoine', ar: 'عمارة وتراث', en: 'Architecture & heritage' } },
  { slug: 'coast', name: { fr: 'Océan & littoral', ar: 'المحيط والساحل', en: 'Ocean & coast' } },
  { slug: 'wildlife', name: { fr: 'Faune & flore', ar: 'الحيوان والنبات', en: 'Wildlife & plants' } },
  { slug: 'cities', name: { fr: 'Villes', ar: 'المدن', en: 'Cities' } },
  { slug: 'night-sky', name: { fr: 'Nuit & ciel', ar: 'الليل والسماء', en: 'Night & sky' } },
  { slug: 'events', name: { fr: 'Événements', ar: 'مناسبات', en: 'Events' } },
]

export const categorySlugs = categories.map((c) => c.slug) as [string, ...Array<string>]

export function getCategory(slug: string | null | undefined): Category | undefined {
  return categories.find((c) => c.slug === slug)
}

export function categoryName(slug: string | null | undefined, locale: Locale): string {
  return getCategory(slug)?.name[locale] ?? ''
}

export const orientations = ['landscape', 'portrait', 'square'] as const
export type Orientation = (typeof orientations)[number]

export function orientationOf(width: number, height: number): Orientation {
  const ratio = width / height
  if (ratio > 1.08) return 'landscape'
  if (ratio < 0.92) return 'portrait'
  return 'square'
}
