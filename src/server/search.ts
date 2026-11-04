import { categories } from '@/lib/categories'
import { regions } from '@/lib/regions'
import { normalizeForSearch } from '@/lib/text'

/** Denormalised, accent/diacritic-insensitive search text covering all three languages. */
export function buildSearchText(p: {
  title: string
  description: string
  tags: Array<string>
  locationText: string
  authorName: string
  regionSlug: string
  category: string
}): string {
  const region = regions.find((r) => r.slug === p.regionSlug)
  const category = categories.find((c) => c.slug === p.category)
  return normalizeForSearch(
    [
      p.title,
      p.description,
      p.tags.join(' '),
      p.locationText,
      p.authorName,
      ...(region ? Object.values(region.name) : []),
      ...(category ? Object.values(category.name) : []),
    ].join(' '),
  ).slice(0, 4000)
}
