import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { env } from '../env'
import { newId } from '../crypto'
import { serverTranslator } from '@/i18n/server'

export type EmailMessage = { to: string; subject: string; text: string }

/**
 * Email provider interface. "console" (development/test) writes messages to
 * .data/mail/*.json and logs a one-line summary; "resend" uses the Resend API.
 */
export interface EmailProvider {
  send: (message: EmailMessage) => Promise<void>
}

const consoleProvider: EmailProvider = {
  async send(message) {
    const dir = join(process.cwd(), env().DEV_MAIL_DIR)
    await mkdir(dir, { recursive: true })
    const file = join(dir, `${Date.now()}-${newId(6)}.json`)
    await writeFile(file, JSON.stringify({ ...message, sentAt: new Date().toISOString() }, null, 2))
    if (env().isProduction) {
      console.warn(`[email] EMAIL_PROVIDER=console in production — "${message.subject}" was NOT delivered.`)
    } else {
      console.info(`[email] to=${message.to} subject="${message.subject}" → ${file}`)
    }
  },
}

const resendProvider: EmailProvider = {
  async send(message) {
    const e = env()
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: e.EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  },
}

function provider(): EmailProvider {
  return env().EMAIL_PROVIDER === 'resend' ? resendProvider : consoleProvider
}

/** Sends an email; failures are logged and never leak to the caller's response. */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  try {
    await provider().send(message)
    return true
  } catch (err) {
    console.error('[email] send failed', err instanceof Error ? err.message : err)
    return false
  }
}

export function absoluteUrl(path: string): string {
  return new URL(path, env().APP_URL).toString()
}

function withSignature(locale: string, body: string): string {
  const { t } = serverTranslator(locale)
  return `${body}\n\n— ${t('email.signature')}\n${absoluteUrl('/')}`
}

/* ------------------------------------------------------------ templates */

export async function sendVerificationEmail(to: string, name: string, locale: string, token: string) {
  const { t, locale: l } = serverTranslator(locale)
  const url = absoluteUrl(`/${l}/auth/verify?token=${encodeURIComponent(token)}`)
  return sendEmail({ to, subject: t('email.verifySubject'), text: withSignature(l, t('email.verifyBody', { name, url })) })
}

export async function sendExistingAccountEmail(to: string, locale: string) {
  const { t, locale: l } = serverTranslator(locale)
  const url = absoluteUrl(`/${l}/auth/forgot`)
  return sendEmail({ to, subject: t('email.existingSubject'), text: withSignature(l, t('email.existingBody', { url })) })
}

export async function sendResetEmail(to: string, locale: string, token: string) {
  const { t, locale: l } = serverTranslator(locale)
  const url = absoluteUrl(`/${l}/auth/reset?token=${encodeURIComponent(token)}`)
  return sendEmail({ to, subject: t('email.resetSubject'), text: withSignature(l, t('email.resetBody', { url })) })
}

export async function sendApprovedEmail(to: string, name: string, locale: string, title: string, path: string) {
  const { t, locale: l } = serverTranslator(locale)
  return sendEmail({
    to,
    subject: t('email.approvedSubject', { title }),
    text: withSignature(l, t('email.approvedBody', { name, title, url: absoluteUrl(path) })),
  })
}

export async function sendRejectedEmail(
  to: string,
  name: string,
  locale: string,
  title: string,
  reason: string,
  note: string,
  days: number,
) {
  const { t, locale: l } = serverTranslator(locale)
  return sendEmail({
    to,
    subject: t('email.rejectedSubject', { title }),
    text: withSignature(
      l,
      t('email.rejectedBody', { name, title, reason, note, days, url: absoluteUrl(`/${l}/dashboard`) }),
    ),
  })
}

export async function sendUrgentReportAlert() {
  const to = env().MODERATION_ALERT_EMAIL
  if (!to) return false
  const { t } = serverTranslator('fr')
  return sendEmail({
    to,
    subject: t('email.urgentSubject'),
    text: t('email.urgentBody', { url: absoluteUrl('/fr/admin/review?filter=urgent') }),
  })
}
