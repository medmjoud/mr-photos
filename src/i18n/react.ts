import { useLocale, useTranslations } from 'use-intl'
import type { Locale } from './config'

export function useAppLocale(): Locale {
  return useLocale()
}

/** Translates a server error (stable code in `error.message`) into the current language. */
export function useErrorText() {
  const t = useTranslations('errors')
  return (err: unknown): string => {
    const code = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
    if (code && t.has(code as never)) return t(code as never)
    return t('generic')
  }
}
