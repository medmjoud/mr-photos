import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useTranslations } from 'use-intl'
import { reportPhoto } from '@/functions/public.functions'
import { REPORT_REASONS, type ReportReason } from '@/lib/codes'
import { useAppLocale, useErrorText } from '@/i18n/react'
import { Button } from '../ui/Button'
import { Field, Textarea } from '../ui/Field'
import { Icon } from '../ui/Icon'
import { Notice } from '../ui/Notice'

/** "Report" button + native dialog, available on every public photo. */
export function ReportButton({ photoId }: { photoId: string }) {
  const t = useTranslations('report')
  const photoT = useTranslations('photo')
  const common = useTranslations('common')
  const reasons = useTranslations('moderation.report')
  const locale = useAppLocale()
  const errorText = useErrorText()
  const reportFn = useServerFn(reportPhoto)
  const ref = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.showModal()}>
        <Icon name="flag" size={16} />
        {photoT('report')}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={`report-${photoId}`}
        className="m-auto max-h-[90dvh] w-[min(34rem,calc(100%-2rem))] overflow-y-auto border border-line-strong bg-bg-raised p-0 text-ink backdrop:bg-black/70"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <h2 id={`report-${photoId}`} className="text-title">
            {t('title')}
          </h2>
          <button type="button" className="btn btn-ghost btn-sm min-w-11 px-0" aria-label={common('close')} onClick={() => ref.current?.close()}>
            <Icon name="close" />
          </button>
        </div>
        {sent ? (
          <div className="p-5">
            <Notice kind="ok">{t('sent')}</Notice>
          </div>
        ) : (
          <form
            className="flex flex-col gap-5 p-5"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!reason) return
              setBusy(true)
              setError(null)
              try {
                await reportFn({ data: { photoId, reason, details } })
                setSent(true)
              } catch (err) {
                setError(errorText(err))
              } finally {
                setBusy(false)
              }
            }}
          >
            <p className="text-small text-ink-muted">{t('lead')}</p>
            {error ? <Notice kind="danger">{error}</Notice> : null}
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-2 text-small font-semibold">{t('reason')}</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex min-h-10 cursor-pointer items-center gap-3 text-small">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="mt-0" />
                  <span className={r === 'csam' ? 'font-semibold text-danger' : undefined}>{reasons(r)}</span>
                </label>
              ))}
            </fieldset>
            <p className="text-micro text-ink-muted">{t('urgentNote')}</p>
            <Field label={t('details')} hint={t('detailsHint')}>
              {({ id, describedBy }) => (
                <Textarea id={id} aria-describedby={describedBy} rows={3} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
              )}
            </Field>
            <p className="text-micro text-ink-muted">
              {t.rich('takedownLink', {
                link: (chunks) => (
                  <Link to="/$locale/report" params={{ locale }} className="link">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
            <Button type="submit" variant="danger" busy={busy} disabled={!reason} className="w-fit">
              {t('submit')}
            </Button>
          </form>
        )}
      </dialog>
    </>
  )
}
