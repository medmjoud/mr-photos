import type { ReactNode } from 'react'
import { IntlProvider } from 'use-intl'
import type { Locale } from '@/i18n/config'
import type { Messages } from '@/i18n/load'

/** Nested provider with the full catalogue for signed-in areas. */
export function PrivateMessages({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  return (
    <IntlProvider locale={locale} messages={messages} timeZone="Africa/Nouakchott">
      {children}
    </IntlProvider>
  )
}
