import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useTranslations } from 'use-intl'
import { requestPasswordReset } from '@/functions/auth.functions'
import { AuthShell } from '@/components/layout/AuthShell'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { useErrorText } from '@/i18n/react'
import { headTranslator, privateHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/auth/forgot')({
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('auth.forgotTitle') ?? 'SOURA'),
  component: ForgotPage,
})

function ForgotPage() {
  const t = useTranslations('auth')
  const errorText = useErrorText()
  const resetFn = useServerFn(requestPasswordReset)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <AuthShell title={t('forgotTitle')} lead={t('forgotLead')}>
      {sent ? (
        <Notice kind="ok">{t('forgotSent')}</Notice>
      ) : (
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError(null)
            try {
              await resetFn({ data: { email } })
              setSent(true)
            } catch (err) {
              setError(errorText(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          {error ? <Notice kind="danger">{error}</Notice> : null}
          <Field label={t('email')} required>
            {({ id, describedBy }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" size="lg" busy={busy} className="w-fit">
            {t('forgotSubmit')}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
