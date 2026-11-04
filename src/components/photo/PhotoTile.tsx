import { Link } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { useAppLocale } from '@/i18n/react'
import { regionName } from '@/lib/regions'
import type { PublicPhoto } from '@/server/public'
import { Photo } from './Photo'

/** Gallery tile: the whole tile is one link; the credit line slides in on hover/focus. */
export function PhotoTile({
  photo,
  sizes = '(min-width: 88rem) 25vw, (min-width: 56rem) 33vw, (min-width: 26rem) 50vw, 100vw',
  priority = false,
  eager = false,
}: {
  photo: PublicPhoto
  sizes?: string
  priority?: boolean
  eager?: boolean
}) {
  const locale = useAppLocale()
  const t = useTranslations('photo')
  const common = useTranslations('common')
  return (
    <Link
      to="/$locale/photos/$slug"
      params={{ locale, slug: photo.segment }}
      className="group relative block focus-visible:outline-offset-4"
    >
      <Photo
        src={photo.thumb}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        blur={photo.blur}
        sizes={sizes}
        priority={priority}
        eager={eager}
        className="img-zoom scrim"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 text-white sm:p-4 hover-device:translate-y-2 hover-device:opacity-0 hover-device:transition hover-device:duration-300 hover-device:group-hover:translate-y-0 hover-device:group-hover:opacity-100 hover-device:group-focus-visible:translate-y-0 hover-device:group-focus-visible:opacity-100">
        <p className="line-clamp-2 font-display text-[1.05rem] leading-tight">{photo.title}</p>
        <p className="mt-1 text-micro text-white/80">
          {t('by', { name: photo.authorName })} · {regionName(photo.regionSlug, locale)}
        </p>
      </div>
      {photo.isDemo ? (
        <span className="absolute start-2 top-2 z-10 rounded-pill bg-warn px-2 py-0.5 text-micro font-bold text-bg">
          {common('demo')}
        </span>
      ) : null}
    </Link>
  )
}

export function Masonry({ photos, priorityCount = 0 }: { photos: Array<PublicPhoto>; priorityCount?: number }) {
  return (
    <ul className="masonry">
      {photos.map((p, i) => (
        <li key={p.id}>
          <PhotoTile photo={p} priority={i < priorityCount} eager={i < priorityCount + 4} />
        </li>
      ))}
    </ul>
  )
}
