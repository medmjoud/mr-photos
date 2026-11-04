import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslations } from 'use-intl'
import { MAP_PATHS, MAP_VIEWBOX } from '@/lib/map-paths'
import { regions } from '@/lib/regions'
import { useAppLocale } from '@/i18n/react'
import { cx } from '@/lib/cx'
import type { PublicPhoto } from '@/server/public'
import { Photo } from '../photo/Photo'
import { Icon } from '../ui/Icon'

/**
 * Interactive map of Mauritania's regions. The SVG is a visual enhancement
 * (aria-hidden); the list of region links is the accessible control and
 * keyboard users drive the map highlight through it.
 */
export function RegionMap({
  counts,
  samples,
}: {
  counts: Record<string, number>
  samples: Record<string, PublicPhoto | undefined>
}) {
  const t = useTranslations('home')
  const locale = useAppLocale()
  const navigate = useNavigate()
  const firstWithPhotos = regions.find((r) => (counts[r.slug] ?? 0) > 0)?.slug ?? 'adrar'
  const [active, setActive] = useState<string>(firstWithPhotos)
  const region = regions.find((r) => r.slug === active)!
  const count = counts[active] ?? 0
  const sample = samples[active]
  const max = Math.max(1, ...Object.values(counts))

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
      <div className="relative lg:col-span-6">
        <svg viewBox={MAP_VIEWBOX} className="h-auto w-full" aria-hidden="true" role="presentation">
          {regions.map((r) => {
            const p = MAP_PATHS[r.slug]
            if (!p) return null
            const c = counts[r.slug] ?? 0
            const isActive = r.slug === active
            return (
              <path
                key={r.slug}
                d={p.d}
                className={cx(
                  'cursor-pointer stroke-[1.5] transition-[fill,opacity] duration-300',
                  isActive ? 'fill-accent stroke-bg' : c > 0 ? 'fill-sand stroke-bg' : 'fill-surface-2 stroke-bg',
                )}
                style={!isActive && c > 0 ? { opacity: 0.35 + 0.55 * (c / max) } : undefined}
                onMouseEnter={() => setActive(r.slug)}
                onClick={() => void navigate({ to: '/$locale/explore', params: { locale }, search: { region: r.slug } })}
              />
            )
          })}
          {/* Nouakchott is tiny at this scale: a larger, visible target. */}
          {MAP_PATHS.nouakchott ? (
            <circle
              cx={MAP_PATHS.nouakchott.cx}
              cy={MAP_PATHS.nouakchott.cy}
              r={18}
              className={cx('cursor-pointer stroke-bg stroke-[3]', active === 'nouakchott' ? 'fill-accent' : 'fill-sand')}
              onMouseEnter={() => setActive('nouakchott')}
              onClick={() => void navigate({ to: '/$locale/explore', params: { locale }, search: { region: 'nouakchott' } })}
            />
          ) : null}
          {MAP_PATHS[active] ? (
            <circle cx={MAP_PATHS[active].cx} cy={MAP_PATHS[active].cy} r={6} className="pointer-events-none fill-bg" />
          ) : null}
        </svg>
        <p className="mt-3 text-micro text-ink-subtle">{t('mapCredit')}</p>
      </div>

      <div className="flex flex-col gap-8 lg:col-span-5 lg:col-start-8">
        <div className="min-h-[19rem]" aria-live="polite">
          <p className="tabular eyebrow">{t('regionCount', { count })}</p>
          <h3 className="mt-2 text-display-md">{region.name[locale]}</h3>
          <p className="mt-3 max-w-[44ch] text-ink-muted">{region.blurb[locale]}</p>
          {sample ? (
            <Link to="/$locale/explore" params={{ locale }} search={{ region: active }} className="group mt-6 block max-w-sm">
              <Photo
                src={sample.thumb}
                alt={sample.alt}
                width={sample.width}
                height={sample.height}
                blur={sample.blur}
                sizes="(min-width: 64rem) 24rem, 90vw"
                className="img-zoom max-h-64"
              />
            </Link>
          ) : (
            <p className="mt-6 border-s-2 border-line-strong ps-4 text-small text-ink-subtle">{t('regionEmpty')}</p>
          )}
          <Link
            to={count > 0 ? '/$locale/explore' : '/$locale/for-photographers'}
            params={{ locale }}
            search={count > 0 ? { region: active } : undefined}
            className="btn btn-secondary btn-sm mt-6"
          >
            {count > 0 ? t('regionCta') : t('regionCtaEmpty')}
            <Icon name="arrowRight" size={16} className="rtl:rotate-180" />
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-x-6 border-t border-line pt-6 sm:grid-cols-3 lg:grid-cols-2">
          {regions.map((r) => (
            <li key={r.slug}>
              <Link
                to="/$locale/explore"
                params={{ locale }}
                search={{ region: r.slug }}
                onMouseEnter={() => setActive(r.slug)}
                onFocus={() => setActive(r.slug)}
                className={cx(
                  'flex min-h-10 items-center justify-between gap-2 text-small transition-colors',
                  r.slug === active ? 'text-ink' : 'text-ink-muted hover:text-ink',
                )}
              >
                <span>{r.name[locale]}</span>
                <span className="tabular text-micro text-ink-subtle">{counts[r.slug] ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
