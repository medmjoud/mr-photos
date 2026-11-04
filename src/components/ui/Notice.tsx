import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import { Icon, type IconName } from './Icon'

const tone = {
  info: { icon: 'info', cls: 'border-line-strong text-ink', role: 'status' },
  ok: { icon: 'check', cls: 'border-ok/50 text-ink', role: 'status' },
  warn: { icon: 'alert', cls: 'border-warn/60 text-ink', role: 'status' },
  danger: { icon: 'alert', cls: 'border-danger/60 text-ink', role: 'alert' },
} as const satisfies Record<string, { icon: IconName; cls: string; role: string }>

const iconColor = { info: 'text-ink-muted', ok: 'text-ok', warn: 'text-warn', danger: 'text-danger' }

export function Notice({
  kind = 'info',
  title,
  children,
  className,
}: {
  kind?: keyof typeof tone
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const t = tone[kind]
  return (
    <div role={t.role} className={cx('flex gap-3 border-s-2 bg-surface/60 px-4 py-3', t.cls, className)}>
      <Icon name={t.icon} className={cx('mt-0.5 flex-none', iconColor[kind])} />
      <div className="text-small leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? 'mt-0.5 text-ink-muted' : undefined}>{children}</div> : null}
      </div>
    </div>
  )
}
