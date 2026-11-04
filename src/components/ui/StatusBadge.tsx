import { useTranslations } from 'use-intl'
import { cx } from '@/lib/cx'
import { Icon, type IconName } from './Icon'

export type BadgeStatus = 'pending' | 'approved' | 'rejected' | 'removed' | 'hidden' | 'processing' | 'failed'

const styles: Record<BadgeStatus, { icon: IconName; cls: string }> = {
  pending: { icon: 'clock', cls: 'text-warn border-warn/50' },
  approved: { icon: 'check', cls: 'text-ok border-ok/50' },
  rejected: { icon: 'close', cls: 'text-danger border-danger/50' },
  removed: { icon: 'trash', cls: 'text-ink-muted border-line-strong' },
  hidden: { icon: 'eyeOff', cls: 'text-danger border-danger/50' },
  processing: { icon: 'clock', cls: 'text-ink-muted border-line-strong' },
  failed: { icon: 'alert', cls: 'text-danger border-danger/50' },
}

/** Status pill: colour + icon + text (never colour alone). */
export function StatusBadge({ status, className }: { status: BadgeStatus; className?: string }) {
  const t = useTranslations('status')
  const s = styles[status]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-micro font-semibold',
        s.cls,
        className,
      )}
    >
      <Icon name={s.icon} size={14} />
      {t(status)}
    </span>
  )
}
