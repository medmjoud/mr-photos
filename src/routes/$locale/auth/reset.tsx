import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useTranslations } from 'use-intl'
import { resetPassword } from '@/functions/auth.functions'
import { AuthShell } from '@/components/layout/AuthShell'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { useAppLocale, useErrorText } from '@/i18n/react'
import { headTranslator, privateHead } from '@/lib/seo'
import { str } from '@/lib/search-params'

export const Route = createFileRoute('/$locale/auth/reset')({
  validateSearch: (s: Record<string, unknown>): { token?: string } => ({ token: str(s.token, 100) }),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('auth.resetTitle') ?? 'SOURA'),
  component: ResetPage,
})

function ResetPage() {
  const t = useTranslations('auth')
  const errors = useTranslations('errors')
  const locale = useAppLocale()
  const errorText = useErrorText()
  const router = useRouter()
  const { token } = Route.useSearch()
  const resetFn = useServerFn(resetPassword)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(token ? null : errors('token_invalid'))

  return (
    <AuthShell title={t('resetTitle')}>
      <form
        className="flex flex-col gap-6"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          if (!token) return
          if (password.length < 10) return setError(errors('password_weak'))
          if (password !== confirm) return setError(errors('passwords_mismatch'))
          setBusy(true)
          setError(null)
          try {
            await resetFn({ data: { token, password } })
            await router.invalidate()
            await router.navigate({ to: '/$locale/dashboard', params: { locale } })
          } catch (err) {
            setError(errorText(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        {error ? <Notice kind="danger">{error}</Notice> : null}
        <Field label={t('password')} hint={t('passwordHint')} required>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('passwordConfirm')} required>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" size="lg" busy={busy} disabled={!token} className="w-fit">
          {t('resetSubmit')}
        </Button>
      </form>
    </AuthShell>
  )
}
