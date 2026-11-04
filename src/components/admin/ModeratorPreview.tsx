import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { Icon } from '../ui/Icon'
import { cx } from '@/lib/cx'

/**
 * Private moderation preview (signed URL). Potentially harmful items are
 * blurred until the moderator explicitly reveals them.
 */
export function ModeratorPreview({
  src,
  width,
  height,
  blur,
  locked,
  className,
  size = 'md',
}: {
  src: string | null
  width: number
  height: number
  blur: boolean
  locked: boolean
  className?: string
  size?: 'md' | 'lg'
}) {
  const t = useTranslations('admin.queue')
  const cs = useTranslations('admin.childSafety')
  const [revealed, setRevealed] = useState(false)
  const ratio = `${width}/${height}`

  if (locked) {
    return (
      <div className={cx('flex flex-col items-center justify-center gap-3 bg-surface p-6 text-center', className)} style={{ aspectRatio: ratio }}>
        <Icon name="lock" size={28} className="text-danger" />
        <p className="text-small font-semibold">{cs('title')}</p>
      </div>
    )
  }
  if (!src) {
    return (
      <div className={cx('flex items-center justify-center bg-surface text-small text-ink-muted', className)} style={{ aspectRatio: ratio }}>
        {t('noPreview')}
      </div>
    )
  }
  const hidden = blur && !revealed
  return (
    <div className={cx('photo-frame', className)} style={{ aspectRatio: ratio }}>
      {hidden ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface p-4 text-center">
          <Icon name="eyeOff" size={24} className="text-warn" />
          <p className="text-small font-semibold">{t('blurred')}</p>
          {size === 'lg' ? <p className="max-w-[46ch] text-small text-ink-muted">{t('revealWarning')}</p> : null}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRevealed(true)}>
            {t('reveal')}
          </button>
        </div>
      ) : (
        <img src={src} alt="" loading="lazy" decoding="async" className="object-contain!" />
      )}
    </div>
  )
}
