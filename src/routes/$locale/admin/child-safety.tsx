import { createFileRoute } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { z } from 'zod'
import { Eyebrow } from '@/components/ui/Editorial'
import { Icon } from '@/components/ui/Icon'
import { Notice } from '@/components/ui/Notice'
import { headTranslator, privateHead } from '@/lib/seo'

/** Instructions shown after (and available before) the child-safety procedure. LEGAL REVIEW REQUIRED. */
export const Route = createFileRoute('/$locale/admin/child-safety')({
  validateSearch: z.object({ ref: z.string().regex(/^[a-z0-9]{16}$/).optional() }),
  head: ({ matches }) => privateHead(headTranslator(matches)?.t('admin.childSafety.title') ?? 'SOURA'),
  component: ChildSafetyPage,
})

function ChildSafetyPage() {
  const t = useTranslations('admin.childSafety')
  const { ref } = Route.useSearch()
  const steps = [t('step1'), t('step2'), t('step3'), t('step4'), t('step5')]
  return (
    <div className="container-page grid gap-10 py-12 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <Eyebrow>{t('title')}</Eyebrow>
        {ref ? (
          <div className="mt-6 flex flex-col gap-3 border-s-2 border-danger ps-5">
            <h1 className="flex items-center gap-3 text-display-md">
              <Icon name="lock" size={28} className="text-danger" />
              {t('doneTitle')}
            </h1>
            <p className="text-small text-ink-muted">
              <span className="eyebrow me-2">{t('reference')}</span>
              <code className="font-mono text-ink">{ref}</code> — {t('loggedAt')}
            </p>
          </div>
        ) : (
          <h1 className="mt-4 text-display-lg">{t('title')}</h1>
        )}
        <Notice kind="warn" className="mt-8">
          {t('legalReview')}
        </Notice>
        <h2 className="mt-10 text-title">{t('steps')}</h2>
        <ol className="mt-4 flex flex-col gap-4">
          {steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[2.5rem_1fr] gap-2">
              <span className="tabular font-display text-title text-danger">{i + 1}</span>
              <p className="text-ink-muted">{s}</p>
            </li>
          ))}
        </ol>
      </div>
      <aside className="lg:col-span-4 lg:col-start-9">
        <p className="text-small text-ink-muted">{t('explain')}</p>
      </aside>
    </div>
  )
}
