import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { getUploadConfig } from '@/functions/upload.functions'
import { PhotoFields, emptyPhotoForm, toFields, type PhotoFormValues } from '@/components/upload/PhotoFields'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Notice } from '@/components/ui/Notice'
import { PageIntro } from '@/components/ui/Editorial'
import { useAppLocale } from '@/i18n/react'
import { headTranslator, privateHead } from '@/lib/seo'
import { cx } from '@/lib/cx'

export const Route = createFileRoute('/$locale/dashboard/upload')({
  loader: () => getUploadConfig(),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('upload.title') ?? 'SOURA'),
  component: UploadPage,
})

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'

type UploadResult = { status: number; body: { id?: string; error?: string; fields?: Array<string> } }

/** XHR (not fetch) so we can show upload progress on slow connections. */
function send(form: FormData, onProgress: (pct: number) => void): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/photos/upload')
    xhr.responseType = 'json'
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => resolve({ status: xhr.status, body: (xhr.response ?? {}) as UploadResult['body'] })
    xhr.onerror = () => reject(new Error('network'))
    xhr.send(form)
  })
}

function UploadPage() {
  const t = useTranslations('upload')
  const errors = useTranslations('errors')
  const locale = useAppLocale()
  const config = Route.useLoaderData()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{ url: string; w: number; h: number } | null>(null)
  const [values, setValues] = useState<PhotoFormValues>(() => emptyPhotoForm(config.displayName))
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const maxMb = Math.round(config.maxBytes / 1024 / 1024)

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview.url) : undefined), [preview])

  const uploadError = (code: string): string => {
    const params = { minPx: config.minLongEdge, minShort: config.minShortEdge, maxMb }
    const key = `errors.${code}` as const
    if (t.has(key as never)) return t(key as never, params as never)
    if (errors.has(code as never)) return errors(code as never)
    return errors('generic')
  }

  function pick(f: File | undefined | null) {
    setError(null)
    if (!f) return
    if (f.size > config.maxBytes) {
      setError(uploadError('file_too_large'))
      return
    }
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      setPreview({ url, w: img.naturalWidth, h: img.naturalHeight })
      // Early, client-side hint only; the server re-checks everything.
      const long = Math.max(img.naturalWidth, img.naturalHeight)
      const short = Math.min(img.naturalWidth, img.naturalHeight)
      if (long < config.minLongEdge || short < config.minShortEdge) setError(uploadError('resolution_too_low'))
    }
    img.onerror = () => setPreview({ url, w: 0, h: 0 })
    img.src = url
    setFile(f)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const missing = new Set<string>()
    if (!file) missing.add('file')
    for (const k of ['title', 'regionSlug', 'category', 'authorName', 'yearTaken'] as const) {
      if (!values[k].trim()) missing.add(k)
    }
    if (!values.hasPeople) missing.add('hasPeople')
    if (!values.hasMinor) missing.add('hasMinor')
    if (!values.confirmRights) missing.add('confirmRights')
    if (!values.confirmConsent) missing.add('confirmConsent')
    if (!values.confirmRules) missing.add('confirmRules')
    setInvalid(missing)
    if (missing.size) {
      setError(missing.has('file') ? uploadError('file_missing') : errors('invalid_input'))
      errorRef.current?.focus()
      return
    }
    const form = new FormData()
    for (const [k, v] of Object.entries(toFields(values))) form.set(k, v)
    form.set('file', file as File)
    setProgress(0)
    try {
      const res = await send(form, setProgress)
      if (res.status === 201) {
        setDone(true)
        window.scrollTo({ top: 0 })
        return
      }
      if (res.body.fields?.length) setInvalid(new Set(res.body.fields))
      setError(uploadError(res.body.error ?? 'generic'))
      errorRef.current?.focus()
    } catch {
      setError(uploadError('network'))
    } finally {
      setProgress(null)
    }
  }

  if (done) {
    return (
      <div className="container-page grid gap-10 py-16 md:grid-cols-12 md:py-24">
        <div className="md:col-span-7">
          <p className="eyebrow text-ok">{t('successTitle')}</p>
          <h1 className="mt-4 text-display-xl">{values.title}</h1>
          <p className="mt-6 max-w-[52ch] text-body-lg text-ink-muted">{t('successBody')}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/$locale/dashboard" params={{ locale }} className="btn btn-primary btn-lg">
              {t('toDashboard')}
            </Link>
            <button
              type="button"
              className="btn btn-secondary btn-lg"
              onClick={() => {
                setDone(false)
                setFile(null)
                setPreview(null)
                setValues(emptyPhotoForm(values.authorName))
              }}
            >
              {t('uploadAnother')}
            </button>
          </div>
        </div>
        {preview ? (
          <div className="photo-frame md:col-span-5" style={{ aspectRatio: preview.w && preview.h ? `${preview.w}/${preview.h}` : '3/2' }}>
            <img src={preview.url} alt={t('previewAlt')} />
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <PageIntro title={t('title')} lead={t('lead')} />
      <form onSubmit={onSubmit} noValidate className="container-page grid gap-12 pb-24 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <p className="mb-1.5 text-small font-semibold">{t('fileLabel')}</p>
            <label
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                pick(e.dataTransfer.files[0])
              }}
              className={cx(
                'relative flex min-h-72 cursor-pointer flex-col items-center justify-center gap-3 border border-dashed p-6 text-center transition-colors',
                dragging ? 'border-accent bg-surface' : 'border-line-strong hover:border-ink-muted',
                invalid.has('file') && 'border-danger',
              )}
              style={preview?.w ? { aspectRatio: `${preview.w}/${preview.h}` } : undefined}
            >
              {preview ? (
                <img src={preview.url} alt={t('previewAlt')} className="absolute inset-0 h-full w-full object-contain" />
              ) : (
                <>
                  <Icon name="upload" size={28} className="text-sand" />
                  <span className="text-ink-muted">
                    {t('dropzone')} <span className="link font-semibold text-ink">{t('chooseFile')}</span>
                  </span>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                aria-describedby="file-hint"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </label>
            <p id="file-hint" className="mt-2 text-small text-ink-muted">
              {t('fileHint', { maxMb, minPx: config.minLongEdge })}
            </p>
            {preview ? (
              <div className="mt-3 flex items-center justify-between gap-3 text-small text-ink-muted">
                <span className="tabular">
                  {preview.w} × {preview.h}px · {((file?.size ?? 0) / 1024 / 1024).toFixed(1)} MB
                </span>
                <button type="button" className="link" onClick={() => inputRef.current?.click()}>
                  {t('replaceFile')}
                </button>
              </div>
            ) : null}
            <p className="mt-6 border-s-2 border-line-strong ps-4 text-small text-ink-muted">{t('privacyNote')}</p>
          </div>
        </div>

        <div className="flex flex-col gap-10 lg:col-span-7">
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            {error ? <Notice kind="danger">{error}</Notice> : null}
          </div>
          <PhotoFields values={values} onChange={setValues} invalid={invalid} />
          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-8">
            <Button type="submit" size="lg" busy={progress !== null}>
              {progress !== null ? t('uploading', { percent: progress }) : t('submit')}
            </Button>
            {progress !== null ? (
              <div className="h-1 w-40 overflow-hidden bg-surface-2" aria-hidden>
                <div className="h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            ) : null}
          </div>
        </div>
      </form>
    </>
  )
}
