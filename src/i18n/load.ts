import type { Locale } from './config'
import type fr from './messages/fr.json'

export type Messages = typeof fr

/** Loads one locale's messages; Vite splits each locale into its own chunk. */
export async function loadMessages(locale: Locale): Promise<Messages> {
  switch (locale) {
    case 'ar':
      return (await import('./messages/ar.json')).default
    case 'en':
      return (await import('./messages/en.json')).default
    default:
      return (await import('./messages/fr.json')).default
  }
}
