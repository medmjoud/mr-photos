import { useRef, useState, type ReactNode } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useFormatter, useTranslations } from 'use-intl'
import {
  approve,
  childSafety,
  feature,
  hide,
  reject,
  remove,
  rerunAiCheck,
  restore,
  retry,
  reviewItem,
} from '@/functions/admin.functions'
import { ModeratorPreview } from '@/components/admin/ModeratorPreview'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Notice } from '@/components/ui/Notice'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useAppLocale, useErrorText } from '@/i18n/react'
import { REJECTION_REASONS } from '@/lib/codes'
import { ALT_MAX, ALT_MIN } from '@/lib/moderation'
import { categoryName } from '@/lib/categories'
import { regionName } from '@/lib/regions'
import { headTranslator, privateHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/admin/review/$id')({
  loader: ({ params }) => reviewItem({ data: { id: params.id } }),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('admin.nav.review') ?? 'SOURA'),
  component: ReviewItemPage,
})

type Item = Awaited<ReturnType<typeof reviewItem>>

function ReviewItemPage() {
  const t = useTranslations('admin')
  const p = Route.useLoaderData()
  const locale = useAppLocale()
  const format = useFormatter()
  const aiT = useTranslations('moderation.ai')
  const aiStatus = useTranslations('moderation.aiStatus')
  const reportT = useTranslations('moderation.report')
  const hiddenT = useTranslations('moderation.hiddenReason')
  const common = useTranslations('common')
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="container-page py-10">
      <Link to="/$locale/admin/review" params={{ locale }} className="link inline-flex items-center gap-2 text-small">
        <Icon name="arrowLeft" size={16} className="rtl:rotate-180" />
        {t('item.back')}
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <ModeratorPreview
            src={p.preview}
            width={p.width}
            height={p.height}
            blur={p.blur}
            locked={p.csamLocked}
            size="lg"
            className="max-h-[80vh]"
          />
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-small text-ink-muted">
            <span className="tabular">
              {p.width} × {p.height}px · {(p.bytes / 1024 / 1024).toFixed(1)} MB · {p.mime}
            </span>
            {p.original ? (
              <a href={p.original} className="link" rel="noopener">
                {t('item.original')}
              </a>
            ) : null}
            {p.publicSegment && !p.hidden ? (
              <Link to="/$locale/photos/$slug" params={{ locale, slug: p.publicSegment }} className="link">
                {t('item.public')}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:col-span-5">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                status={p.processing === 'failed' ? 'failed' : p.processing !== 'ready' ? 'processing' : p.hidden ? 'hidden' : p.status}
              />
              {p.urgent ? <span className="text-micro font-bold text-danger">{t('queue.filters.urgent')}</span> : null}
            </div>
            <h1 className="mt-3 text-display-md" dir="auto">
              {p.title}
            </h1>
            {p.hiddenReason ? <p className="mt-2 text-small text-danger">{hiddenT(p.hiddenReason)}</p> : null}
          </header>

          <Section title={t('item.metadata')}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-small">
              <dt className="text-ink-muted">{t('item.owner')}</dt>
              <dd>
                {p.ownerName} · {p.ownerEmail}
                <span className="block text-ink-subtle">
                  {t('item.ownerSince', { date: format.dateTime(new Date(p.ownerSince), { dateStyle: 'medium' }) })}
                  {p.ownerStatus === 'suspended' ? ` · ${t('users.suspended')}` : ''}
                </span>
              </dd>
              <dt className="text-ink-muted">©</dt>
              <dd>
                {p.authorName}, {p.yearTaken}
              </dd>
              <dt className="text-ink-muted">
                <Icon name="pin" size={16} />
              </dt>
              <dd>
                {regionName(p.regionSlug, locale)}
                {p.locationText ? ` — ${p.locationText}` : ''}
              </dd>
              <dt className="text-ink-muted">
                <Icon name="grid" size={16} />
              </dt>
              <dd>{categoryName(p.category, locale)}</dd>
              <dt className="text-ink-muted">
                <Icon name="clock" size={16} />
              </dt>
              <dd>{t('item.uploaded', { date: date(p.createdAt) })}</dd>
            </dl>
            {p.description ? (
              <p dir="auto" className="mt-4 whitespace-pre-line text-small text-ink-muted">
                {p.description}
              </p>
            ) : null}
            {p.tags.length ? <p className="mt-2 text-small text-ink-subtle">#{p.tags.join(' #')}</p> : null}
          </Section>

          <Section title={t('item.declarations')}>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-small">
              <dt>{t('item.people')}</dt>
              <dd className="font-semibold">{p.hasPeople ? common('yes') : common('no')}</dd>
              <dt className={p.hasMinor ? 'font-semibold text-warn' : undefined}>{t('item.minor')}</dt>
              <dd className={p.hasMinor ? 'font-semibold text-warn' : 'font-semibold'}>{p.hasMinor ? common('yes') : common('no')}</dd>
            </dl>
            <p className="mt-2 text-small text-ink-muted">
              <Icon name="check" size={16} className="me-1 inline text-ok" />
              {t('item.rightsOk')}
            </p>
          </Section>

          <Section title={t('item.ai')}>
            <p className={p.aiStatus === 'flagged' ? 'text-small font-semibold text-danger' : 'text-small'}>{aiStatus(p.aiStatus)}</p>
            {p.aiFlags.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {p.aiFlags.map((f) => (
                  <li key={f.category} className="rounded-pill border border-danger/50 px-2.5 py-0.5 text-micro text-danger">
                    {aiT(f.category)} · {Math.round(f.score * 100)}%
                  </li>
                ))}
              </ul>
            ) : null}
            {p.aiError ? <p className="mt-1 font-mono text-micro text-ink-subtle">{p.aiError}</p> : null}
            <p className="mt-2 text-small text-ink-muted">{t('item.aiNever')}</p>
          </Section>

          {p.sameFile.length ? (
            <Notice kind="warn" title={t('item.sameFile')}>
              {p.sameFile.some((s) => s.otherOwner) ? t('item.sameFileOther') : null}
            </Notice>
          ) : null}
          {p.processingError ? (
            <Notice kind="danger" title={t('item.processingError')}>
              <span className="font-mono">{p.processingError}</span>
            </Notice>
          ) : null}

          <Section title={t('item.reports')}>
            {p.reports.length === 0 ? (
              <p className="text-small text-ink-muted">{t('item.noReports')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {p.reports.map((r) => (
                  <li key={r.id} className="border-s-2 border-line-strong ps-3 text-small">
                    <p className={r.reason === 'csam' ? 'font-semibold text-danger' : 'font-semibold'}>{reportT(r.reason)}</p>
                    {r.details ? <p className="mt-0.5 whitespace-pre-line text-ink-muted">{r.details}</p> : null}
                    <p className="mt-0.5 text-ink-subtle">
                      {date(r.createdAt)} · {t(`reports.status.${r.status}`)}
                      {r.reporterEmail ? ` · ${r.reporterName} <${r.reporterEmail}>` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {!p.csamLocked ? <Actions p={p} /> : null}

          <Section title={t('item.history')}>
            <ol className="flex flex-col gap-1.5 font-mono text-micro text-ink-muted">
              {p.log.map((l) => (
                <li key={l.id}>
                  <span className="text-ink-subtle">{date(l.createdAt)}</span> · <span className="text-ink">{l.action}</span>
                  {l.actorId ? '' : ` · ${t('log.system')}`}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h2 className="eyebrow mb-3 font-sans">{title}</h2>
      {children}
    </section>
  )
}

function useAction() {
  const router = useRouter()
  const errorText = useErrorText()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'danger'; text: string } | null>(null)
  async function run(name: string, fn: () => Promise<unknown>, okText: string) {
    setBusy(name)
    setMessage(null)
    try {
      await fn()
      setMessage({ kind: 'ok', text: okText })
      await router.invalidate()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      setMessage({ kind: 'danger', text: code.startsWith('cannot_approve') ? code : errorText(err) })
    } finally {
      setBusy(null)
    }
  }
  return { busy, message, run }
}

function Actions({ p }: { p: Item }) {
  const t = useTranslations('admin')
  const blockers = useTranslations('moderation.blockers')
  const reasons = useTranslations('moderation.rejection')
  const common = useTranslations('common')
  const locale = useAppLocale()
  const router = useRouter()
  const { busy, message, run } = useAction()
  const approveFn = useServerFn(approve)
  const rejectFn = useServerFn(reject)
  const hideFn = useServerFn(hide)
  const restoreFn = useServerFn(restore)
  const removeFn = useServerFn(remove)
  const retryFn = useServerFn(retry)
  const rerunFn = useServerFn(rerunAiCheck)
  const featureFn = useServerFn(feature)
  const childSafetyFn = useServerFn(childSafety)
  const [alt, setAlt] = useState({ fr: p.altFr, ar: p.altAr, en: p.altEn })
  const [featured, setFeatured] = useState(false)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState<(typeof REJECTION_REASONS)[number]>('low_quality')
  const [rejectNote, setRejectNote] = useState('')
  const [confirmWord, setConfirmWord] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const canDecide = p.status === 'pending' && p.processing === 'ready'
  const altOk = alt.fr.trim().length >= ALT_MIN

  return (
    <div className="flex flex-col gap-8">
      {message ? (
        <Notice kind={message.kind}>
          {message.text.startsWith('cannot_approve:')
            ? message.text
                .slice('cannot_approve:'.length)
                .split(',')
                .map((b) => blockers(b as never))
                .join(' ')
            : message.text}
        </Notice>
      ) : null}

      {canDecide ? (
        <>
          <form
            className="flex flex-col gap-4 border-t border-line pt-5"
            onSubmit={(e) => {
              e.preventDefault()
              void run(
                'approve',
                () => approveFn({ data: { id: p.id, altFr: alt.fr, altAr: alt.ar, altEn: alt.en, featured, note } }),
                t('approve.done'),
              )
            }}
          >
            <h2 className="eyebrow font-sans text-ok">{t('approve.title')}</h2>
            <p className="text-small text-ink-muted">{t('approve.altHint')}</p>
            <Field label={t('approve.altFr')} required error={!altOk && alt.fr ? blockers('alt_missing') : null}>
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  rows={2}
                  maxLength={ALT_MAX}
                  required
                  lang="fr"
                  dir="ltr"
                  value={alt.fr}
                  onChange={(e) => setAlt({ ...alt, fr: e.target.value })}
                />
              )}
            </Field>
            <Field label={t('approve.altAr')}>
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  rows={2}
                  maxLength={ALT_MAX}
                  lang="ar"
                  dir="rtl"
                  value={alt.ar}
                  onChange={(e) => setAlt({ ...alt, ar: e.target.value })}
                />
              )}
            </Field>
            <Field label={t('approve.altEn')}>
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  rows={2}
                  maxLength={ALT_MAX}
                  lang="en"
                  dir="ltr"
                  value={alt.en}
                  onChange={(e) => setAlt({ ...alt, en: e.target.value })}
                />
              )}
            </Field>
            <Checkbox label={t('approve.featured')} checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            <Field label={t('approve.note')}>
              {({ id }) => <Input id={id} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />}
            </Field>
            <Button type="submit" busy={busy === 'approve'} disabled={!altOk} className="w-fit">
              <Icon name="check" size={18} />
              {t('approve.submit')}
            </Button>
          </form>

          <form
            className="flex flex-col gap-4 border-t border-line pt-5"
            onSubmit={(e) => {
              e.preventDefault()
              void run('reject', () => rejectFn({ data: { id: p.id, reason, note: rejectNote } }), t('reject.done', { days: p.retentionDays }))
            }}
          >
            <h2 className="eyebrow font-sans text-danger">{t('reject.title')}</h2>
            <Field label={t('reject.reason')} required>
              {({ id }) => (
                <Select id={id} value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
                  {REJECTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {reasons(r)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('reject.note')} hint={t('reject.noteHint')}>
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  rows={2}
                  maxLength={1000}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" variant="danger" busy={busy === 'reject'} className="w-fit">
              {t('reject.submit')}
            </Button>
          </form>
        </>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-line pt-5">
        {p.status === 'approved' && !p.hidden ? (
          <Button variant="secondary" size="sm" busy={busy === 'hide'} onClick={() => run('hide', () => hideFn({ data: { id: p.id, note: '' } }), t('actions.done'))}>
            {t('actions.hide')}
          </Button>
        ) : null}
        {p.status === 'approved' && p.hidden ? (
          <Button variant="secondary" size="sm" busy={busy === 'restore'} onClick={() => run('restore', () => restoreFn({ data: { id: p.id, note: '' } }), t('actions.done'))}>
            {t('actions.restore')}
          </Button>
        ) : null}
        {p.status === 'approved' ? (
          <Button
            variant="secondary"
            size="sm"
            busy={busy === 'feature'}
            onClick={() => run('feature', () => featureFn({ data: { id: p.id, featured: !p.featured } }), t('actions.done'))}
          >
            {p.featured ? t('actions.unfeature') : t('actions.feature')}
          </Button>
        ) : null}
        {p.status === 'approved' || p.status === 'pending' ? (
          <Button
            variant="danger"
            size="sm"
            busy={busy === 'remove'}
            onClick={() => {
              if (window.confirm(t('actions.remove'))) void run('remove', () => removeFn({ data: { id: p.id, note: '' } }), t('actions.done'))
            }}
          >
            {t('actions.remove')}
          </Button>
        ) : null}
        {p.processing === 'failed' ? (
          <Button variant="secondary" size="sm" busy={busy === 'retry'} onClick={() => run('retry', () => retryFn({ data: { id: p.id } }), t('actions.done'))}>
            {t('actions.retry')}
          </Button>
        ) : null}
        {p.processing === 'ready' ? (
          <Button variant="ghost" size="sm" busy={busy === 'rerun'} onClick={() => run('rerun', () => rerunFn({ data: { id: p.id } }), t('actions.done'))}>
            {t('actions.rerunAi')}
          </Button>
        ) : null}
      </div>

      <div className="border-t border-danger/40 pt-5">
        <button type="button" className="btn btn-danger w-full justify-start" onClick={() => dialogRef.current?.showModal()}>
          <Icon name="shield" size={18} />
          {t('childSafety.button')}
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="cs-title"
        className="m-auto w-[min(36rem,calc(100%-2rem))] border border-danger/50 bg-bg-raised p-0 text-ink backdrop:bg-black/70"
      >
        <form
          className="flex flex-col gap-5 p-6"
          onSubmit={async (e) => {
            e.preventDefault()
            if (confirmWord !== 'CSAM') return
            await run('csam', () => childSafetyFn({ data: { id: p.id, confirm: 'CSAM' } }), t('childSafety.doneTitle'))
            dialogRef.current?.close()
            await router.navigate({ to: '/$locale/admin/child-safety', params: { locale }, search: { ref: p.id } })
          }}
        >
          <h2 id="cs-title" className="text-title text-danger">
            {t('childSafety.title')}
          </h2>
          <Notice kind="warn">{t('childSafety.legalReview')}</Notice>
          <p className="text-small text-ink-muted">{t('childSafety.explain')}</p>
          <Field label={t('childSafety.typeToConfirm')} required>
            {({ id }) => (
              <Input id={id} autoComplete="off" value={confirmWord} onChange={(e) => setConfirmWord(e.target.value.trim())} />
            )}
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="danger" disabled={confirmWord !== 'CSAM'} busy={busy === 'csam'}>
              {t('childSafety.confirm')}
            </Button>
            <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
              {common('cancel')}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
