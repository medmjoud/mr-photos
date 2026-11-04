import { createTranslator } from 'use-intl/core'
import { defaultLocale, isLocale, type Locale } from './config'
import ar from './messages/ar.json'
import en from './messages/en.json'
import fr from './messages/fr.json'

const all = { fr, ar, en } as const

/** Server-side translator (emails, server-rendered strings outside React). */
export function serverTranslator(locale: string | null | undefined) {
  const l: Locale = isLocale(locale) ? locale : defaultLocale
  return { locale: l, t: createTranslator({ locale: l, messages: all[l] }) }
}
