/**
 * Text helpers shared by client and server.
 */

const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g

/**
 * Normalises text for search: lower-case, strips Latin accents, Arabic
 * diacritics/tatweel, and unifies common Arabic letter variants.
 */
export function normalizeForSearch(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function searchTerms(query: string): Array<string> {
  return normalizeForSearch(query)
    .split(' ')
    .filter((t) => t.length >= 2)
    .slice(0, 6)
}

/** URL slug from a title (Latin transliteration only; Arabic titles fall back to "photo"). */
export function slugify(input: string, fallback = 'photo'): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  return slug || fallback
}

/** Public photo URL segment: "<slug>-<id>". Ids never contain "-". */
export function photoSegment(title: string, id: string): string {
  return `${slugify(title)}-${id}`
}

export function idFromSegment(segment: string): string | null {
  const id = segment.split('-').pop() ?? ''
  return /^[a-z0-9]{16}$/.test(id) ? id : null
}

/** Removes control characters and trims; collapses internal whitespace runs. */
export function cleanLine(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function cleanMultiline(input: string): string {
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function parseTags(input: string | Array<string>): Array<string> {
  const raw = Array.isArray(input) ? input : input.split(/[,،#\n]/)
  const seen = new Set<string>()
  const out: Array<string> = []
  for (const t of raw) {
    const tag = cleanLine(t).toLowerCase().slice(0, 32)
    if (tag.length < 2 || seen.has(tag)) continue
    seen.add(tag)
    out.push(tag)
    if (out.length >= 15) break
  }
  return out
}

/** Unicode first-strong isolate: keeps user text (e.g. a Latin name) from breaking the surrounding RTL/LTR sentence. */
export function bidi(s: string): string {
  return `\u2068${s}\u2069`
}
