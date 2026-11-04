import { cx } from '@/lib/cx'

/** SOURA + صورة, side by side in both scripts (see DESIGN.md › Wordmark). */
export function Wordmark({ className, size = 'md' }: { className?: string; size?: 'md' | 'xl' }) {
  return (
    <span
      className={cx(
        'inline-flex items-baseline gap-2 leading-none text-ink',
        size === 'xl' ? 'text-display-xl' : 'text-[1.375rem]',
        className,
      )}
      dir="ltr"
    >
      <span className="font-semibold tracking-[-0.02em]" style={{ fontFamily: "'Soura Wordmark Latin', Georgia, serif" }} lang="fr">
        SOURA
      </span>
      <span aria-hidden className="text-sand" style={{ fontSize: '0.5em', transform: 'translateY(-0.4em)' }}>
        ·
      </span>
      <span lang="ar" className="font-semibold" style={{ fontSize: '1.05em', fontFamily: "'Soura Wordmark Arabic', serif" }}>
        صورة
      </span>
    </span>
  )
}
