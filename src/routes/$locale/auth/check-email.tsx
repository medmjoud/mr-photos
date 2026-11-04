import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useTranslations } from 'use-intl'
import { z } from 'zod'
import { resendVerification } from '@/functions/auth.functions'
import { AuthShell } from '@/components/layout/AuthShell'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { headTranslator, privateHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/auth/check-email')({
  validateSearch: z.object({ email: z.string().max(254).optional() }),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('auth.checkEmailTitle') ?? 'SOURA'),
  component: CheckEmailPage,
})

function CheckEmailPage() {
  const t = useTranslations('auth')
  const { email = '' } = Route.useSearch()
  const resendFn = useServerFn(resendVerification)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <AuthShell title={t('checkEmailTitle')}>
      <p className="text-body-lg text-ink-muted">{t('checkEmailBody', { email: email || '—' })}</p>
      <div className="mt-8">
        {sent ? (
          <Notice kind="ok">{t('resent')}</Notice>
        ) : email ? (
          <Button
            variant="secondary"
            busy={busy}
            onClick={async () => {
              setBusy(true)
              await resendFn({ data: { email } }).catch(() => undefined)
              setBusy(false)
              setSent(true)
            }}
          >
            {t('resend')}
          </Button>
        ) : null}
      </div>
    </AuthShell>
  )
}
