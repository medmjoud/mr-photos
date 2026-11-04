import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useTranslations } from 'use-intl'
import { z } from 'zod'
import { login, resendVerification } from '@/functions/auth.functions'
import { AuthShell } from '@/components/layout/AuthShell'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { useAppLocale, useErrorText } from '@/i18n/react'
import { headTranslator, privateHead } from '@/lib/seo'
import { safeNext } from '@/lib/nav'

export const Route = createFileRoute('/$locale/auth/login')({
  validateSearch: z.object({ next: z.string().optional() }),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('auth.loginTitle') ?? 'SOURA'),
  component: LoginPage,
})

function LoginPage() {
  const t = useTranslations('auth')
  const locale = useAppLocale()
  const errorText = useErrorText()
  const router = useRouter()
  const { next } = Route.useSearch()
  const loginFn = useServerFn(login)
  const resendFn = useServerFn(resendVerification)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [resent, setResent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setUnverified(false)
    try {
      const res = await loginFn({ data: { email, password } })
      await router.invalidate()
      const fallback = res.role === 'admin' ? `/${locale}/admin` : `/${locale}/dashboard`
      await router.navigate({ href: safeNext(next, locale) ?? fallback })
    } catch (err) {
      if (err instanceof Error && err.message === 'email_unverified') setUnverified(true)
      else setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title={t('loginTitle')} lead={t('loginLead')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        {error ? <Notice kind="danger">{error}</Notice> : null}
        {unverified ? (
          <Notice kind="warn" title={t('unverifiedTitle')}>
            <p>{t('unverifiedBody')}</p>
            {resent ? (
              <p className="mt-2">{t('resent')}</p>
            ) : (
              <button
                type="button"
                className="link mt-2 font-semibold text-ink"
                onClick={async () => {
                  await resendFn({ data: { email } }).catch(() => undefined)
                  setResent(true)
                }}
              >
                {t('resend')}
              </button>
            )}
          </Notice>
        ) : null}
        <Field label={t('email')} required>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('password')} required>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button type="submit" size="lg" busy={busy}>
            {t('loginSubmit')}
          </Button>
          <Link to="/$locale/auth/forgot" params={{ locale }} className="link text-small">
            {t('forgot')}
          </Link>
        </div>
        <p className="border-t border-line pt-6 text-small text-ink-muted">
          {t('noAccount')}{' '}
          <Link to="/$locale/auth/signup" params={{ locale }} className="link font-semibold text-ink">
            {t('signupSubmit')}
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
