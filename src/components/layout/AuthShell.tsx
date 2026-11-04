import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'

/** Editorial two-column frame for sign-in, sign-up and recovery pages. */
export function AuthShell({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children: ReactNode }) {
  const meta = useTranslations('meta')
  return (
    <div className="container-page grid gap-12 py-12 md:grid-cols-12 md:py-20">
      <aside className="hidden flex-col justify-between border-e border-line pe-10 md:col-span-5 md:flex">
        <p className="font-display text-display-lg text-ink-muted">{meta('tagline')}</p>
        <p aria-hidden className="text-[clamp(6rem,14vw,12rem)] leading-none text-surface-2" style={{ fontFamily: "'Soura Wordmark Arabic', serif" }}>
          ص
        </p>
      </aside>
      <section className="md:col-span-6 md:col-start-7 lg:col-span-5 lg:col-start-8">
        <h1 className="text-display-lg">{title}</h1>
        {lead ? <p className="mt-4 text-ink-muted">{lead}</p> : null}
        <div className="mt-10">{children}</div>
      </section>
    </div>
  )
}
