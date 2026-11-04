import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useTranslations } from 'use-intl'
import { z } from 'zod'
import { verifyEmail } from '@/functions/auth.functions'
import { AuthShell } from '@/components/layout/AuthShell'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { useAppLocale } from '@/i18n/react'
import { headTranslator, privateHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/auth/verify')({
  validateSearch: z.object({ token: z.string().max(100).optional() }),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('auth.verifyTitle') ?? 'SOURA'),
  component: VerifyPage,
})

/**
 * Verification is an explicit POST (button), never a GET side effect, so
 * email link scanners cannot confirm addresses or open sessions.
 */
function VerifyPage() {
  const t = useTranslations('auth')
  const common = useTranslations('common')
  const locale = useAppLocale()
  const router = useRouter()
  const { token } = Route.useSearch()
  const verifyFn = useServerFn(verifyEmail)
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>(token ? 'idle' : 'failed')

  if (state === 'done') {
    return (
      <AuthShell title={t('verifiedTitle')} lead={t('verifiedBody')}>
        <Link to="/$locale/dashboard" params={{ locale }} className="btn btn-primary btn-lg">
          {t('goToDashboard')}
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('verifyTitle')}>
      {state === 'failed' ? (
        <div className="flex flex-col gap-6">
          <Notice kind="danger">{t('verifyFailed')}</Notice>
          <Link to="/$locale/auth/login" params={{ locale }} className="link w-fit">
            {t('loginSubmit')}
          </Link>
        </div>
      ) : (
        <Button
          size="lg"
          busy={state === 'busy'}
          onClick={async () => {
            if (!token) return
            setState('busy')
            try {
              await verifyFn({ data: { token } })
              await router.invalidate()
              setState('done')
            } catch {
              setState('failed')
            }
          }}
        >
          {common('continue')}
        </Button>
      )}
    </AuthShell>
  )
}
