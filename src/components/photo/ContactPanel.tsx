import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useTranslations } from 'use-intl'
import { revealContact } from '@/functions/public.functions'
import { useAppLocale, useErrorText } from '@/i18n/react'
import { Icon } from '../ui/Icon'
import { Notice } from '../ui/Notice'

type Revealed = { channel: 'whatsapp' | 'email'; display: string; href: string }

/**
 * Contact options. Only availability flags reach the page; the number or
 * address is fetched from a rate-limited endpoint after an explicit click,
 * so it never appears in the HTML source.
 */
export function ContactPanel({
  slug,
  name,
  photoId,
  contact,
}: {
  slug: string
  name: string
  photoId?: string
  contact: { whatsapp: boolean; email: boolean }
}) {
  const t = useTranslations('contact')
  const locale = useAppLocale()
  const errorText = useErrorText()
  const revealFn = useServerFn(revealContact)
  const [revealed, setRevealed] = useState<Partial<Record<'whatsapp' | 'email', Revealed>>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function reveal(channel: 'whatsapp' | 'email') {
    setBusy(channel)
    setError(null)
    try {
      const r = await revealFn({ data: { slug, channel, photoId, locale } })
      setRevealed((prev) => ({ ...prev, [channel]: r }))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  if (!contact.whatsapp && !contact.email) {
    return <p className="text-small text-ink-muted">{t('none')}</p>
  }

  const channels = (['whatsapp', 'email'] as const).filter((c) => contact[c])
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <p className="text-small text-ink-muted">{t('lead')}</p>
      {error ? <Notice kind="danger">{error}</Notice> : null}
      <ul className="flex flex-col gap-3">
        {channels.map((c) => {
          const r = revealed[c]
          return (
            <li key={c} className="border border-line p-4">
              <p className="eyebrow flex items-center gap-2">
                <Icon name={c === 'whatsapp' ? 'message' : 'mail'} size={16} />
                {t(c)}
              </p>
              {r ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="tabular font-semibold select-all" dir="ltr">
                    {r.display}
                  </span>
                  <a
                    href={r.href}
                    className="btn btn-primary btn-sm"
                    target={c === 'whatsapp' ? '_blank' : undefined}
                    rel={c === 'whatsapp' ? 'noopener noreferrer' : undefined}
                  >
                    {c === 'whatsapp' ? t('openWhatsapp') : t('openEmail')}
                    <Icon name="arrowUpRight" size={16} className="rtl:-scale-x-100" />
                  </a>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(r.display)
                        setCopied(c)
                      } catch {
                        /* clipboard unavailable */
                      }
                    }}
                  >
                    {copied === c ? t('copied') : t('copy')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm mt-3"
                  aria-busy={busy === c || undefined}
                  disabled={busy !== null}
                  onClick={() => reveal(c)}
                  aria-label={`${c === 'whatsapp' ? t('revealWhatsapp') : t('revealEmail')} — ${name}`}
                >
                  {c === 'whatsapp' ? t('revealWhatsapp') : t('revealEmail')}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-micro text-ink-subtle">{t('privacy')}</p>
      <p className="text-micro text-ink-subtle">{t('licenseNote')}</p>
    </div>
  )
}
