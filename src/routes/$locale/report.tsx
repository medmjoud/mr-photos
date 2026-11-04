import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useTranslations } from 'use-intl'
import { submitTakedown } from '@/functions/public.functions'
import { EditorialPage } from '@/components/layout/EditorialPage'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { loadPage } from '@/content/load'
import { isLocale } from '@/i18n/config'
import { useErrorText } from '@/i18n/react'
import { REPORT_REASONS, type ReportReason } from '@/lib/codes'
import { headTranslator, seo } from '@/lib/seo'

export const Route = createFileRoute('/$locale/report')({
  loader: ({ params }) => loadPage(isLocale(params.locale) ? params.locale : 'fr', 'report'),
  head: ({ matches, params, loaderData }) => {
    const h = headTranslator(matches)
    if (!h || !loaderData) return {}
    return seo({ locale: params.locale, siteUrl: h.siteUrl, path: '/report', title: `${loaderData.title} · SOURA`, description: loaderData.lead })
  },
  component: ReportPage,
})

function ReportPage() {
  return (
    <EditorialPage content={Route.useLoaderData()}>
      <TakedownForm />
    </EditorialPage>
  )
}

function TakedownForm() {
  const t = useTranslations('takedown')
  const reasons = useTranslations('moderation.report')
  const errorText = useErrorText()
  const submitFn = useServerFn(submitTakedown)
  const [v, setV] = useState({ name: '', email: '', photoUrl: '', reason: 'stolen' as ReportReason, details: '', goodFaith: false })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="not-prose mt-14 border-t border-line pt-10" aria-labelledby="takedown-title">
      <h2 id="takedown-title" className="font-display text-display-md text-ink">
        {t('formTitle')}
      </h2>
      <Notice kind="danger" title={t('urgentTitle')} className="mt-6">
        {t('urgentBody')}
      </Notice>
      {sent ? (
        <Notice kind="ok" className="mt-8">
          {t('sent')}
        </Notice>
      ) : (
        <form
          className="mt-8 grid gap-6 text-body md:grid-cols-2"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault()
            if (!v.goodFaith) return
            setBusy(true)
            setError(null)
            try {
              await submitFn({ data: { ...v, goodFaith: true } })
              setSent(true)
            } catch (err) {
              setError(errorText(err))
            } finally {
              setBusy(false)
            }
          }}
        >
          {error ? <Notice kind="danger" className="md:col-span-2">{error}</Notice> : null}
          <Field label={t('name')} required>
            {({ id }) => <Input id={id} required autoComplete="name" maxLength={100} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />}
          </Field>
          <Field label={t('email')} hint={t('emailHint')} required>
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} type="email" required autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
            )}
          </Field>
          <Field label={t('photoUrl')} hint={t('photoUrlHint')} className="md:col-span-2">
            {({ id, describedBy }) => (
              <Input id={id} aria-describedby={describedBy} type="url" dir="ltr" maxLength={500} value={v.photoUrl} onChange={(e) => setV({ ...v, photoUrl: e.target.value })} />
            )}
          </Field>
          <Field label={t('reason')} required className="md:col-span-2">
            {({ id }) => (
              <Select id={id} value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value as ReportReason })}>
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {reasons(r)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('details')} hint={t('detailsHint')} required className="md:col-span-2">
            {({ id, describedBy }) => (
              <Textarea id={id} aria-describedby={describedBy} required minLength={10} rows={6} maxLength={4000} value={v.details} onChange={(e) => setV({ ...v, details: e.target.value })} />
            )}
          </Field>
          <Checkbox className="md:col-span-2" label={t('goodFaith')} checked={v.goodFaith} onChange={(e) => setV({ ...v, goodFaith: e.target.checked })} required />
          <Button type="submit" size="lg" busy={busy} disabled={!v.goodFaith} className="w-fit">
            {t('submit')}
          </Button>
        </form>
      )}
    </section>
  )
}
