import type { CSSProperties } from 'react'
import { cx } from '@/lib/cx'

type SrcSet = { avif: string; webp: string; fallback: string }

/**
 * Server-generated responsive image: AVIF + WebP sources, explicit
 * width/height (no layout shift) and a blur placeholder behind it.
 * Right-click is NOT disabled — protection comes from watermarked,
 * size-limited derivatives, never from client tricks.
 */
export function Photo({
  src,
  alt,
  width,
  height,
  blur,
  sizes,
  priority = false,
  className,
  imgClassName,
  fit = 'cover',
  transitionName,
}: {
  src: SrcSet
  alt: string
  width: number
  height: number
  blur?: string | null
  sizes: string
  priority?: boolean
  className?: string
  imgClassName?: string
  fit?: 'cover' | 'contain'
  transitionName?: string
}) {
  const style: CSSProperties = { aspectRatio: `${width} / ${height}` }
  if (blur) {
    style.backgroundImage = `url(${blur})`
    style.backgroundSize = 'cover'
  }
  return (
    <picture className={cx('photo-frame block', className)} style={style}>
      {src.avif ? <source type="image/avif" srcSet={src.avif} sizes={sizes} /> : null}
      {src.webp ? <source type="image/webp" srcSet={src.webp} sizes={sizes} /> : null}
      <img
        src={src.fallback}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        className={cx(fit === 'contain' ? 'object-contain!' : undefined, imgClassName)}
        style={transitionName ? { viewTransitionName: transitionName } : undefined}
      />
    </picture>
  )
}
