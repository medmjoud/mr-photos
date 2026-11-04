import { describe, expect, it } from 'vitest'
import { createTranslator } from 'use-intl/core'
import ar from '@/i18n/messages/ar.json'
import en from '@/i18n/messages/en.json'
import fr from '@/i18n/messages/fr.json'
import { negotiateLocale } from '@/i18n/config'
import { idFromSegment, normalizeForSearch, parseTags, photoSegment, slugify } from '@/lib/text'
import { safeNext } from '@/lib/nav'
import { ar as arPages } from '@/content/ar'
import { en as enPages } from '@/content/en'
import { fr as frPages } from '@/content/fr'

function keys(o: Record<string, unknown>, p = ''): Array<string> {
  return Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]))
}

describe('translations', () => {
  it('fr, ar and en define exactly the same keys, none empty', () => {
    const f = keys(fr).sort()
    expect(keys(ar).sort()).toEqual(f)
    expect(keys(en).sort()).toEqual(f)
    for (const m of [fr, ar, en]) for (const k of keys(m)) expect(k.split('.').reduce<unknown>((o, s) => (o as Record<string, unknown>)[s], m)).not.toBe('')
  })
  it('every message compiles (ICU) in every locale', () => {
    for (const [locale, messages] of [['fr', fr], ['ar', ar], ['en', en]] as const) {
      const errors: Array<string> = []
      const t = createTranslator({ locale, messages, onError: (e) => errors.push(e.message) })
      for (const k of keys(messages)) {
         
        ;(t as any).has(k) && (t as any).raw(k)
      }
      expect(errors).toEqual([])
    }
  })
  it('long-form pages exist in all three languages with the same sections', () => {
    for (const key of Object.keys(frPages) as Array<keyof typeof frPages>) {
      expect(arPages[key].sections.length).toBe(frPages[key].sections.length)
      expect(enPages[key].sections.length).toBe(frPages[key].sections.length)
      expect(Boolean(arPages[key].draft)).toBe(Boolean(frPages[key].draft))
    }
    // Legal texts are flagged as drafts needing legal review.
    expect(frPages.terms.draft && frPages.privacy.draft && frPages.report.draft).toBe(true)
  })
  it('negotiates the bare "/" locale from Accept-Language, defaulting to French', () => {
    expect(negotiateLocale('ar-MR,ar;q=0.9,fr;q=0.8')).toBe('ar')
    expect(negotiateLocale('en-US,en;q=0.9')).toBe('en')
    expect(negotiateLocale('de-DE')).toBe('fr')
    expect(negotiateLocale(null)).toBe('fr')
  })
})

describe('text helpers', () => {
  it('normalises Latin accents and Arabic variants for search', () => {
    expect(normalizeForSearch('Chinguétti')).toBe('chinguetti')
    expect(normalizeForSearch('أدرار')).toBe(normalizeForSearch('ادرار'))
    expect(normalizeForSearch('مَدِينَة')).toBe('مدينه')
  })
  it('builds and parses photo URL segments', () => {
    expect(slugify('Marché de la capitale, au matin !')).toBe('marche-de-la-capitale-au-matin')
    expect(slugify('سوق العاصمة')).toBe('photo')
    const seg = photoSegment('Dunes', 'abcdefghij012345')
    expect(idFromSegment(seg)).toBe('abcdefghij012345')
    expect(idFromSegment('dunes-short')).toBeNull()
  })
  it('cleans tags', () => {
    expect(parseTags('Dunes, dunes,  #nuit، a, ' + 'x'.repeat(50))).toEqual(['dunes', 'nuit', 'x'.repeat(32)])
  })
  it('refuses open redirects after login', () => {
    expect(safeNext('/fr/dashboard', 'fr')).toBe('/fr/dashboard')
    expect(safeNext('https://evil.example', 'fr')).toBeNull()
    expect(safeNext('//evil.example/fr/', 'fr')).toBeNull()
    expect(safeNext('/fr/auth/login', 'fr')).toBeNull()
    expect(safeNext('/ar/dashboard', 'fr')).toBeNull()
  })
})
