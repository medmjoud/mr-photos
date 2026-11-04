import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'

/** Section index + label, e.g. "01 — Régions". */
export function Eyebrow({ index, children, className }: { index?: string; children: ReactNode; className?: string }) {
  return (
    <p className={cx('eyebrow flex items-center gap-3', className)}>
      {index ? <span className="tabular text-ink-subtle">{index}</span> : null}
      {index ? <span aria-hidden className="h-px w-8 bg-line-strong" /> : null}
      <span>{children}</span>
    </p>
  )
}

/** Asymmetric section header: eyebrow + display title on the start side, aside on the end side. */
export function SectionHeader({
  index,
  eyebrow,
  title,
  aside,
  id,
  className,
}: {
  index?: string
  eyebrow: ReactNode
  title: ReactNode
  aside?: ReactNode
  id?: string
  className?: string
}) {
  return (
    <header className={cx('grid gap-6 md:grid-cols-12 md:items-end', className)}>
      <div className="md:col-span-8">
        <Eyebrow index={index}>{eyebrow}</Eyebrow>
        <h2 id={id} className="mt-4 text-display-lg">
          {title}
        </h2>
      </div>
      {aside ? <div className="text-ink-muted md:col-span-4 md:justify-self-end md:text-end">{aside}</div> : null}
    </header>
  )
}

/** Designed empty state: one large line, one short paragraph, one action. */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('grid gap-6 border-t border-line pt-10 md:grid-cols-12', className)}>
      <p className="font-display text-display-md text-ink md:col-span-7">{title}</p>
      <div className="flex flex-col items-start gap-6 md:col-span-4 md:col-start-9">
        {body ? <p className="text-ink-muted">{body}</p> : null}
        {action}
      </div>
    </div>
  )
}

export function PageIntro({
  eyebrow,
  title,
  lead,
  children,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  lead?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <header className={cx('container-page pt-12 pb-10 md:pt-20 md:pb-14', className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h1 className="mt-4 max-w-[18ch] text-display-xl">{title}</h1>
      {lead ? <p className="mt-6 max-w-[60ch] text-body-lg text-ink-muted">{lead}</p> : null}
      {children}
    </header>
  )
}
