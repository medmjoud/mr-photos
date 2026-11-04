import { useRef, useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useTranslations } from 'use-intl'
import { getMyProfile, updateMyProfile } from '@/functions/profile.functions'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Notice } from '@/components/ui/Notice'
import { PageIntro } from '@/components/ui/Editorial'
import { useAppLocale, useErrorText } from '@/i18n/react'
import { regions } from '@/lib/regions'
import { headTranslator, privateHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/dashboard/profile')({
  loader: () => getMyProfile(),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('profile.title') ?? 'SOURA'),
  component: ProfilePage,
})

function ProfilePage() {
  const t = useTranslations('profile')
  const common = useTranslations('common')
  const uploadErrors = useTranslations('upload.errors')
  const locale = useAppLocale()
  const router = useRouter()
  const errorText = useErrorText()
  const initial = Route.useLoaderData()
  const updateFn = useServerFn(updateMyProfile)
  const [v, setV] = useState({
    displayName: initial.displayName,
    bio: initial.bio,
    regionSlug: initial.regionSlug,
    city: initial.city,
    website: initial.website,
    instagram: initial.instagram,
    whatsapp: initial.whatsapp ? `+${initial.whatsapp}` : '',
    contactEmail: initial.contactEmail,
    showWhatsapp: initial.showWhatsapp,
    showEmail: initial.showEmail,
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'danger'; text: string } | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = <TKey extends keyof typeof v>(k: TKey, val: (typeof v)[TKey]) => setV({ ...v, [k]: val })
  const waInvalid = v.whatsapp !== '' && !/^\+?[\d\s().-]{8,20}$/.test(v.whatsapp)
  const webInvalid = v.website !== '' && !/^https:\/\/\S+\.\S+$/i.test(v.website)

  return (
    <>
      <PageIntro title={t('title')} lead={t('lead')}>
        <p className="mt-4 text-small text-ink-subtle">{t('publicNote')}</p>
      </PageIntro>
      <form
        className="container-page grid gap-12 pb-24 lg:grid-cols-12"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          if (waInvalid || webInvalid) return
          setBusy(true)
          setMessage(null)
          try {
            await updateFn({ data: v })
            setMessage({ kind: 'ok', text: t('saved') })
            await router.invalidate()
          } catch (err) {
            setMessage({ kind: 'danger', text: errorText(err) })
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="flex flex-col gap-6 lg:col-span-4">
          <p className="text-small font-semibold">{t('avatar')}</p>
          <div className="photo-frame aspect-square w-40 rounded-pill">
            {initial.avatarPreview ? <img src={initial.avatarPreview} alt="" className="rounded-pill" /> : null}
          </div>
          <p className="text-small text-ink-muted">{t(`avatarStatus.${initial.avatarStatus}`)}</p>
          <p className="text-small text-ink-subtle">{t('avatarHint')}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            aria-label={t('avatarUpload')}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setAvatarBusy(true)
              setMessage(null)
              const form = new FormData()
              form.set('file', f)
              const res = await fetch('/api/profile/avatar', { method: 'POST', body: form }).catch(() => null)
              setAvatarBusy(false)
              if (res?.ok) await router.invalidate()
              else {
                const code = ((await res?.json().catch(() => ({}))) as { error?: string } | undefined)?.error ?? 'generic'
                setMessage({ kind: 'danger', text: uploadErrors.has(code as never) ? uploadErrors(code as never, { minPx: 320, minShort: 320, maxMb: 10 } as never) : errorText(code) })
              }
            }}
          />
          <Button variant="secondary" size="sm" busy={avatarBusy} className="w-fit" onClick={() => fileRef.current?.click()}>
            {t('avatarUpload')}
          </Button>
          {initial.slug ? (
            <Link to="/$locale/photographers/$slug" params={{ locale, slug: initial.slug }} className="link text-small">
              {t('viewPublic')}
            </Link>
          ) : null}
        </div>

        <div className="flex flex-col gap-8 lg:col-span-8">
          {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}
          <div className="grid gap-6 md:grid-cols-2">
            <Field label={t('displayName')} required className="md:col-span-2">
              {({ id }) => <Input id={id} required maxLength={60} value={v.displayName} onChange={(e) => set('displayName', e.target.value)} />}
            </Field>
            <Field label={t('bio')} hint={t('bioHint')} className="md:col-span-2">
              {({ id, describedBy }) => (
                <Textarea id={id} aria-describedby={describedBy} rows={5} maxLength={1200} value={v.bio} onChange={(e) => set('bio', e.target.value)} />
              )}
            </Field>
            <Field label={t('region')}>
              {({ id }) => (
                <Select id={id} value={v.regionSlug} onChange={(e) => set('regionSlug', e.target.value)}>
                  <option value="">{t('noRegion')}</option>
                  {regions.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name[locale]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('city')}>
              {({ id }) => <Input id={id} maxLength={80} value={v.city} onChange={(e) => set('city', e.target.value)} />}
            </Field>
            <Field label={t('website')} hint={t('websiteHint')} error={webInvalid ? t('invalidWebsite') : null}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  type="url"
                  inputMode="url"
                  dir="ltr"
                  placeholder="https://"
                  value={v.website}
                  onChange={(e) => set('website', e.target.value)}
                />
              )}
            </Field>
            <Field label={t('instagram')} hint={t('instagramHint')}>
              {({ id, describedBy }) => (
                <Input id={id} aria-describedby={describedBy} dir="ltr" value={v.instagram} onChange={(e) => set('instagram', e.target.value)} />
              )}
            </Field>
          </div>

          <fieldset className="flex flex-col gap-6 border-t border-line pt-8">
            <legend className="mb-2 font-display text-display-md">{t('contactTitle')}</legend>
            <p className="max-w-[62ch] text-small text-ink-muted">{t('contactLead')}</p>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-3">
                <Field label={t('whatsapp')} hint={t('whatsappHint')} error={waInvalid ? t('invalidWhatsapp') : null}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      aria-describedby={describedBy}
                      aria-invalid={invalid || undefined}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      dir="ltr"
                      value={v.whatsapp}
                      onChange={(e) => set('whatsapp', e.target.value)}
                    />
                  )}
                </Field>
                <Checkbox label={t('showWhatsapp')} checked={v.showWhatsapp} disabled={!v.whatsapp} onChange={(e) => set('showWhatsapp', e.target.checked)} />
              </div>
              <div className="flex flex-col gap-3">
                <Field label={t('contactEmail')}>
                  {({ id }) => (
                    <Input id={id} type="email" autoComplete="email" dir="ltr" value={v.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
                  )}
                </Field>
                <Checkbox label={t('showEmail')} checked={v.showEmail} disabled={!v.contactEmail} onChange={(e) => set('showEmail', e.target.checked)} />
              </div>
            </div>
          </fieldset>
          <Button type="submit" size="lg" busy={busy} className="w-fit">
            {common('save')}
          </Button>
        </div>
      </form>
    </>
  )
}
