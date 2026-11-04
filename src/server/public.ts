import { and, eq, isNull, type SQL } from 'drizzle-orm'
import { schema } from './db/client'
import { photoMediaPath, avatarMediaPath } from '@/lib/media'
import { photoSegment } from '@/lib/text'
import type { Locale } from '@/i18n/config'
import type { Photo, Profile } from './db/schema'

/**
 * SQL twin of lib/moderation#isPubliclyVisible. Every public query MUST use
 * this (joined with users) so pending, rejected, hidden, locked photos and
 * photos of suspended accounts can never leak into listings.
 */
export function publicPhotoWhere(...extra: Array<SQL | undefined>): SQL {
  return and(
    eq(schema.photos.status, 'approved'),
    eq(schema.photos.processing, 'ready'),
    isNull(schema.photos.hiddenAt),
    isNull(schema.photos.csamLockedAt),
    eq(schema.users.status, 'active'),
    ...extra,
  )!
}

type SrcSet = { avif: string; webp: string; fallback: string }

function srcset(p: Photo, kind: 'thumb' | 'preview'): SrcSet {
  const vs = p.variants.filter((v) => v.kind === kind).sort((a, b) => a.width - b.width)
  const line = (format: 'avif' | 'webp') =>
    vs
      .filter((v) => v.format === format)
      .map((v) => `${photoMediaPath(p.id, p.publicToken, kind, v.width, format)} ${v.width}w`)
      .join(', ')
  const smallestWebp = vs.find((v) => v.format === 'webp')
  return {
    avif: line('avif'),
    webp: line('webp'),
    fallback: smallestWebp ? photoMediaPath(p.id, p.publicToken, kind, smallestWebp.width, 'webp') : '',
  }
}

export function altFor(p: Pick<Photo, 'altFr' | 'altAr' | 'altEn' | 'title'>, locale: Locale): string {
  return (locale === 'ar' ? p.altAr : locale === 'en' ? p.altEn : p.altFr) || p.altFr || p.title
}

export type PublicPhotographer = { slug: string; displayName: string; isDemo: boolean }

/** Public photo card data. Never includes contact details, owner email or file keys. */
export function toPublicPhoto(p: Photo, owner: PublicPhotographer, locale: Locale) {
  const preview = p.variants.filter((v) => v.kind === 'preview').sort((a, b) => b.width - a.width)[0]
  const og = p.variants.find((v) => v.kind === 'og')
  return {
    id: p.id,
    segment: photoSegment(p.title, p.id),
    title: p.title,
    alt: altFor(p, locale),
    authorName: p.authorName,
    regionSlug: p.regionSlug,
    locationText: p.locationText,
    category: p.category,
    yearTaken: p.yearTaken,
    width: p.width,
    height: p.height,
    orientation: p.orientation,
    blur: p.blurDataUrl,
    thumb: srcset(p, 'thumb'),
    preview: srcset(p, 'preview'),
    previewSize: preview ? { width: preview.width, height: preview.height } : null,
    og: og ? photoMediaPath(p.id, p.publicToken, 'og', og.width, 'jpeg') : null,
    featured: p.featured,
    approvedAt: p.approvedAt?.toISOString() ?? null,
    photographer: owner,
    isDemo: p.isDemo,
  }
}

export type PublicPhoto = ReturnType<typeof toPublicPhoto>

export function publicAvatar(profile: Pick<Profile, 'userId' | 'avatar' | 'avatarStatus'>) {
  if (profile.avatarStatus !== 'approved' || !profile.avatar) return null
  return {
    s160: avatarMediaPath(profile.userId, profile.avatar.token, 160),
    s480: avatarMediaPath(profile.userId, profile.avatar.token, 480),
    blur: profile.avatar.blur,
  }
}
