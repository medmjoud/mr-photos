import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useTranslations } from 'use-intl'
import { signup } from '@/functions/auth.functions'
import { AuthShell } from '@/components/layout/AuthShell'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { useAppLocale, useErrorText } from '@/i18n/react'
import { headTranslator, privateHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/auth/signup')({
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('auth.signupTitle') ?? 'SOURA'),
  component: SignupPage,
})

function SignupPage() {
  const t = useTranslations('auth')
  const errors = useTranslations('errors')
  const locale = useAppLocale()
  const errorText = useErrorText()
  const navigate = useNavigate()
  const signupFn = useServerFn(signup)
  const [form, setForm] = useState({ displayName: '', email: '', password: '', accept: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ password?: string }>({})

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.password.length < 10) {
      setFieldErrors({ password: errors('password_weak') })
      return
    }
    setFieldErrors({})
    if (!form.accept || form.displayName.trim().length < 2) {
      setError(errors('invalid_input'))
      return
    }
    setBusy(true)
    try {
      await signupFn({
        data: {
          email: form.email,
          password: form.password,
          displayName: form.displayName,
          locale,
          acceptTerms: true,
        },
      })
      await navigate({ to: '/$locale/auth/check-email', params: { locale }, search: { email: form.email } })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title={t('signupTitle')} lead={t('signupLead')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        {error ? <Notice kind="danger">{error}</Notice> : null}
        <Field label={t('displayName')} hint={t('displayNameHint')} required>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              autoComplete="name"
              required
              maxLength={60}
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          )}
        </Field>
        <Field label={t('email')} required>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          )}
        </Field>
        <Field label={t('password')} hint={t('passwordHint')} error={fieldErrors.password} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}
        </Field>
        <Checkbox
          required
          checked={form.accept}
          onChange={(e) => setForm({ ...form, accept: e.target.checked })}
          label={t.rich('acceptTerms', {
            terms: (chunks) => (
              <Link to="/$locale/terms" params={{ locale }} className="link" target="_blank">
                {chunks}
              </Link>
            ),
            rules: (chunks) => (
              <Link to="/$locale/content-rules" params={{ locale }} className="link" target="_blank">
                {chunks}
              </Link>
            ),
          })}
        />
        <Button type="submit" size="lg" busy={busy} className="w-fit">
          {t('signupSubmit')}
        </Button>
        <p className="border-t border-line pt-6 text-small text-ink-muted">
          {t('haveAccount')}{' '}
          <Link to="/$locale/auth/login" params={{ locale }} className="link font-semibold text-ink">
            {t('loginSubmit')}
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
