import { Link } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { categories } from '@/lib/categories'
import { regions } from '@/lib/regions'
import { DESCRIPTION_MAX, TITLE_MAX } from '@/lib/schemas'
import { useAppLocale } from '@/i18n/react'
import { Checkbox, Field, Input, RadioGroup, Select, Textarea } from '../ui/Field'

export type PhotoFormValues = {
  title: string
  description: string
  regionSlug: string
  locationText: string
  category: string
  authorName: string
  yearTaken: string
  tags: string
  hasPeople: 'yes' | 'no' | null
  hasMinor: 'yes' | 'no' | null
  confirmRights: boolean
  confirmConsent: boolean
  confirmRules: boolean
}

export function emptyPhotoForm(authorName = ''): PhotoFormValues {
  return {
    title: '',
    description: '',
    regionSlug: '',
    locationText: '',
    category: '',
    authorName,
    yearTaken: String(new Date().getFullYear()),
    tags: '',
    hasPeople: null,
    hasMinor: null,
    confirmRights: false,
    confirmConsent: false,
    confirmRules: false,
  }
}

/** Values as the server's photoMetaSchema expects them (string fields). */
export function toFields(v: PhotoFormValues): Record<string, string> {
  const out: Record<string, string> = {
    title: v.title,
    description: v.description,
    regionSlug: v.regionSlug,
    locationText: v.locationText,
    category: v.category,
    authorName: v.authorName,
    yearTaken: v.yearTaken,
    tags: v.tags,
    hasPeople: v.hasPeople ?? '',
    hasMinor: v.hasMinor ?? '',
  }
  if (v.confirmRights) out.confirmRights = 'true'
  if (v.confirmConsent) out.confirmConsent = 'true'
  if (v.confirmRules) out.confirmRules = 'true'
  return out
}

export function PhotoFields({
  values,
  onChange,
  invalid,
  withDeclarations = true,
}: {
  values: PhotoFormValues
  onChange: (next: PhotoFormValues) => void
  invalid: ReadonlySet<string>
  withDeclarations?: boolean
}) {
  const t = useTranslations('upload')
  const common = useTranslations('common')
  const errors = useTranslations('errors')
  const locale = useAppLocale()
  const set = <TKey extends keyof PhotoFormValues>(k: TKey, v: PhotoFormValues[TKey]) => onChange({ ...values, [k]: v })
  const err = (k: string) => (invalid.has(k) ? errors('invalid_input') : null)
  const yesNo = [
    { value: 'yes' as const, label: common('yes') },
    { value: 'no' as const, label: common('no') },
  ]
  const year = new Date().getFullYear()

  return (
    <div className="flex flex-col gap-12">
      <fieldset className="grid gap-6 md:grid-cols-2">
        <legend className="mb-6 font-display text-display-md">{t('detailsTitle')}</legend>
        <Field label={t('fieldTitle')} hint={t('fieldTitleHint')} error={err('title')} required className="md:col-span-2">
          {({ id, describedBy, invalid: inv }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={inv || undefined}
              required
              minLength={3}
              maxLength={TITLE_MAX}
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
            />
          )}
        </Field>
        <Field label={t('fieldDescription')} hint={t('fieldDescriptionHint')} error={err('description')} className="md:col-span-2">
          {({ id, describedBy }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              maxLength={DESCRIPTION_MAX}
              rows={4}
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
            />
          )}
        </Field>
        <Field label={t('fieldRegion')} error={err('regionSlug')} required>
          {({ id, describedBy, invalid: inv }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              aria-invalid={inv || undefined}
              required
              value={values.regionSlug}
              onChange={(e) => set('regionSlug', e.target.value)}
            >
              <option value="">{t('fieldRegionPlaceholder')}</option>
              {regions.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name[locale]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('fieldLocation')} hint={t('fieldLocationHint')} error={err('locationText')}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              maxLength={120}
              value={values.locationText}
              onChange={(e) => set('locationText', e.target.value)}
            />
          )}
        </Field>
        <Field label={t('fieldCategory')} error={err('category')} required>
          {({ id, describedBy, invalid: inv }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              aria-invalid={inv || undefined}
              required
              value={values.category}
              onChange={(e) => set('category', e.target.value)}
            >
              <option value="">{t('fieldCategoryPlaceholder')}</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name[locale]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('fieldYear')} error={err('yearTaken')} required>
          {({ id, describedBy, invalid: inv }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={inv || undefined}
              type="number"
              inputMode="numeric"
              min={1900}
              max={year}
              required
              value={values.yearTaken}
              onChange={(e) => set('yearTaken', e.target.value)}
            />
          )}
        </Field>
        <Field label={t('fieldAuthor')} hint={t('fieldAuthorHint')} error={err('authorName')} required>
          {({ id, describedBy, invalid: inv }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={inv || undefined}
              required
              maxLength={80}
              value={values.authorName}
              onChange={(e) => set('authorName', e.target.value)}
            />
          )}
        </Field>
        <Field label={t('fieldTags')} hint={t('fieldTagsHint')} error={err('tags')}>
          {({ id, describedBy }) => (
            <Input id={id} aria-describedby={describedBy} value={values.tags} onChange={(e) => set('tags', e.target.value)} />
          )}
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-t border-line pt-10">
        <legend className="mb-6 font-display text-display-md">{t('peopleTitle')}</legend>
        <RadioGroup
          legend={t('peopleLegend')}
          name="hasPeople"
          value={values.hasPeople}
          options={yesNo}
          onChange={(v) => onChange({ ...values, hasPeople: v, hasMinor: v === 'no' ? 'no' : values.hasMinor })}
          error={err('hasPeople')}
        />
        <div>
          <RadioGroup
            legend={t('minorLegend')}
            name="hasMinor"
            value={values.hasMinor}
            options={yesNo}
            onChange={(v) => onChange({ ...values, hasMinor: v, hasPeople: v === 'yes' ? 'yes' : values.hasPeople })}
            error={invalid.has('hasMinor') ? t('errors.minor_requires_people') : null}
          />
          <p className="mt-2 max-w-[60ch] text-small text-ink-muted">{t('minorHint')}</p>
        </div>
      </fieldset>

      {withDeclarations ? (
        <fieldset className="flex flex-col gap-4 border-t border-line pt-10">
          <legend className="mb-6 font-display text-display-md">{t('declarationsTitle')}</legend>
          <Checkbox
            label={t('confirmRights')}
            checked={values.confirmRights}
            onChange={(e) => set('confirmRights', e.target.checked)}
            aria-invalid={invalid.has('confirmRights') || undefined}
            required
          />
          <Checkbox
            label={t('confirmConsent')}
            checked={values.confirmConsent}
            onChange={(e) => set('confirmConsent', e.target.checked)}
            aria-invalid={invalid.has('confirmConsent') || undefined}
            required
          />
          <Checkbox
            label={t.rich('confirmRules', {
              rules: (chunks) => (
                <Link to="/$locale/content-rules" params={{ locale }} className="link" target="_blank">
                  {chunks}
                </Link>
              ),
            })}
            checked={values.confirmRules}
            onChange={(e) => set('confirmRules', e.target.checked)}
            aria-invalid={invalid.has('confirmRules') || undefined}
            required
          />
          {invalid.has('confirmRights') || invalid.has('confirmConsent') || invalid.has('confirmRules') ? (
            <p role="alert" className="text-small font-medium text-danger">
              {t('errors.declarations')}
            </p>
          ) : null}
        </fieldset>
      ) : null}
    </div>
  )
}
