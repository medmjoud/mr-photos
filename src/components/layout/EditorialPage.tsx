import type { ReactNode } from 'react'
import { useFormatter, useTranslations } from 'use-intl'
import type { PageContent } from '@/content/types'
import { Eyebrow } from '../ui/Editorial'
import { Notice } from '../ui/Notice'

/** Long-form page: asymmetric header, sticky table of contents, editorial prose. */
export function EditorialPage({ content, children, aside }: { content: PageContent; children?: ReactNode; aside?: ReactNode }) {
  const t = useTranslations('pages')
  const format = useFormatter()
  return (
    <article>
      <header className="container-page grid gap-6 pt-12 pb-12 md:grid-cols-12 md:pt-20 md:pb-16">
        <div className="md:col-span-9">
          <Eyebrow>{content.eyebrow}</Eyebrow>
          <h1 className="mt-4 max-w-[18ch] text-display-xl">{content.title}</h1>
          <p className="mt-6 max-w-[58ch] text-body-lg text-ink-muted">{content.lead}</p>
          {content.updated ? (
            <p className="mt-4 text-small text-ink-subtle">
              {t('updated', { date: format.dateTime(new Date(content.updated), { dateStyle: 'long' }) })}
            </p>
          ) : null}
        </div>
      </header>
      {content.draft ? (
        <div className="container-page mb-10">
          <Notice kind="warn">{t('draftBanner')}</Notice>
        </div>
      ) : null}
      <div className="container-page grid gap-12 border-t border-line pt-10 pb-24 lg:grid-cols-12">
        <nav aria-label={t('onThisPage')} className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-24">
            <p className="eyebrow mb-4">{t('onThisPage')}</p>
            <ol className="flex flex-col gap-2 text-small">
              {content.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-ink-muted hover:text-ink">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
            {aside}
          </div>
        </nav>
        <div className="prose-soura lg:col-span-7 lg:col-start-5">
          {content.sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 first:[&>h2]:mt-0">
              <h2>{s.title}</h2>
              {s.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
              {s.list ? (
                <ul>
                  {s.list.map((li, i) => (
                    <li key={i}>{li}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
          {children}
        </div>
      </div>
    </article>
  )
}
