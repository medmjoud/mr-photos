import type { Locale } from './config'
import type fr from './messages/fr.json'

export type Messages = typeof fr

/** Namespaces only needed in signed-in areas (dashboard, admin) or on the server (email). */
const PRIVATE_NAMESPACES = ['email', 'admin', 'adminAvatars', 'upload', 'dashboard', 'profile'] as const
const PRIVATE_MODERATION = ['rejection', 'ai', 'aiStatus', 'blockers', 'hiddenReason'] as const

async function importLocale(locale: Locale): Promise<Messages> {
  switch (locale) {
    case 'ar':
      return (await import('./messages/ar.json')).default
    case 'en':
      return (await import('./messages/en.json')).default
    default:
      return (await import('./messages/fr.json')).default
  }
}

/**
 * Public pages receive only the public namespaces (≈ half the catalogue);
 * the dashboard and admin layouts load the full set ("all").
 */
export async function loadMessages(locale: Locale, scope: 'public' | 'all' = 'public'): Promise<Messages> {
  const all = await importLocale(locale)
  const { email: _email, ...withoutEmail } = all
  if (scope === 'all') return withoutEmail as Messages
  const out: Record<string, unknown> = { ...withoutEmail }
  for (const ns of PRIVATE_NAMESPACES) delete out[ns]
  const moderation: Record<string, unknown> = { ...all.moderation }
  for (const k of PRIVATE_MODERATION) delete moderation[k]
  out.moderation = moderation
  return out as Messages
}
