import { cx } from '@/lib/cx'

/** Approved avatar, or a typographic monogram (no stock silhouettes). */
export function Avatar({
  avatar,
  name,
  size = 48,
  className,
}: {
  avatar: { s160: string; s480: string; blur: string } | null
  name: string
  size?: number
  className?: string
}) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '·'
  if (!avatar) {
    return (
      <span
        aria-hidden
        className={cx('inline-flex flex-none items-center justify-center rounded-pill bg-surface-2 font-display text-sand', className)}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {initial}
      </span>
    )
  }
  return (
    <img
      src={size > 160 ? avatar.s480 : avatar.s160}
      srcSet={`${avatar.s160} 160w, ${avatar.s480} 480w`}
      sizes={`${size}px`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cx('flex-none rounded-pill bg-surface object-cover', className)}
      style={{ width: size, height: size, backgroundImage: `url(${avatar.blur})`, backgroundSize: 'cover' }}
    />
  )
}
