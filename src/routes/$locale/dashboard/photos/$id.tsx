import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useTranslations } from 'use-intl'
import { getMyPhoto, updateMyPhoto } from '@/functions/photos.functions'
import { PhotoFields, toFields, type PhotoFormValues } from '@/components/upload/PhotoFields'
import { PageIntro } from '@/components/ui/Editorial'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { useAppLocale, useErrorText } from '@/i18n/react'
import { headTranslator, privateHead } from '@/lib/seo'

export const Route = createFileRoute('/$locale/dashboard/photos/$id')({
  loader: ({ params }) => getMyPhoto({ data: { id: params.id } }),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('dashboard.editTitle') ?? 'SOURA'),
  component: EditPhoto,
})

function EditPhoto() {
  const t = useTranslations('dashboard')
  const common = useTranslations('common')
  const locale = useAppLocale()
  const router = useRouter()
  const errorText = useErrorText()
  const photo = Route.useLoaderData()
  const updateFn = useServerFn(updateMyPhoto)
  const [values, setValues] = useState<PhotoFormValues>({
    title: photo.title,
    description: photo.description,
    regionSlug: photo.regionSlug,
    locationText: photo.locationText,
    category: photo.category,
    authorName: photo.authorName,
    yearTaken: String(photo.yearTaken),
    tags: photo.tags,
    hasPeople: photo.hasPeople ? 'yes' : 'no',
    hasMinor: photo.hasMinor ? 'yes' : 'no',
    // Declarations were given at upload time and still apply.
    confirmRights: true,
    confirmConsent: true,
    confirmRules: true,
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'danger'; text: string } | null>(null)

  return (
    <>
      <PageIntro title={t('editTitle')} lead={photo.canEdit ? t('editLead') : t('editLocked')} />
      <form
        className="container-page grid gap-12 pb-24 lg:grid-cols-12"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setMessage(null)
          try {
            await updateFn({ data: { id: photo.id, fields: toFields(values) } })
            setMessage({ kind: 'ok', text: t('editSaved') })
            await router.invalidate()
          } catch (err) {
            setMessage({ kind: 'danger', text: errorText(err) })
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="lg:col-span-4">
          <div className="photo-frame aspect-square">{photo.thumb ? <img src={photo.thumb} alt="" /> : null}</div>
          <Link to="/$locale/dashboard" params={{ locale }} className="link mt-4 inline-block text-small">
            {common('back')}
          </Link>
        </div>
        <fieldset disabled={!photo.canEdit} className="flex flex-col gap-10 lg:col-span-8">
          {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}
          <PhotoFields values={values} onChange={setValues} invalid={new Set()} withDeclarations={false} />
          {photo.canEdit ? (
            <Button type="submit" size="lg" busy={busy} className="w-fit">
              {common('save')}
            </Button>
          ) : null}
        </fieldset>
      </form>
    </>
  )
}
