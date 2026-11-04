import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { setResponseHeader } from '@tanstack/react-start/server'
import { and, count, desc, eq, inArray, like, ne, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, schema } from '@/server/db/client'
import { publicAvatar, publicPhotoWhere, toPublicPhoto } from '@/server/public'
import { recordEvent } from '@/server/analytics'
import { consumeAll } from '@/server/ratelimit'
import { requestIp, requestUserAgent, visitorHash } from '@/server/request'
import { createReport } from '@/server/moderation/service'
import { ensureWorker } from '@/server/jobs/photos'
import { fail } from '@/server/http'
import { exploreSearchSchema, zId as photoId, zLocale as locale, zSlug as slug } from '@/server/validation'
import { serverTranslator } from '@/i18n/server'
import { regions } from '@/lib/regions'
import { REPORT_REASONS } from '@/lib/codes'
import { cleanMultiline, idFromSegment, searchTerms } from '@/lib/text'

export const PAGE_SIZE = 24

function publicCache() {
  // Public listings are identical for everyone; let browsers/CDNs cache briefly.
  setResponseHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
}

const baseSelect = {
  photo: schema.photos,
  slug: schema.profiles.slug,
  displayName: schema.profiles.displayName,
  profileDemo: schema.profiles.isDemo,
}

function owner(r: { slug: string; displayName: string; profileDemo: boolean }) {
  return { slug: r.slug, displayName: r.displayName, isDemo: r.profileDemo }
}

/* -------------------------------------------------------------- explore */


export const explorePhotos = createServerFn({ method: 'GET' })
  .validator(exploreSearchSchema.extend({ locale }))
  .handler(async ({ data }) => {
    ensureWorker()
    const db = await getDb()
    const page = data.page ?? 1
    const terms = searchTerms(data.q ?? '')
    const where = publicPhotoWhere(
      data.region ? eq(schema.photos.regionSlug, data.region) : undefined,
      data.category ? eq(schema.photos.category, data.category) : undefined,
      data.orientation ? eq(schema.photos.orientation, data.orientation) : undefined,
      data.photographer ? eq(schema.profiles.slug, data.photographer) : undefined,
      ...terms.map((t) => like(schema.photos.searchText, `%${t}%`)),
    )
    const [rows, total] = await Promise.all([
      db
        .select(baseSelect)
        .from(schema.photos)
        .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
        .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.photos.ownerId))
        .where(where)
        .orderBy(desc(schema.photos.approvedAt))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE),
      db
        .select({ n: count() })
        .from(schema.photos)
        .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
        .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.photos.ownerId))
        .where(where)
        .get(),
    ])
    const photographer = data.photographer
      ? await db
          .select({ slug: schema.profiles.slug, displayName: schema.profiles.displayName })
          .from(schema.profiles)
          .where(eq(schema.profiles.slug, data.photographer))
          .get()
      : null
    publicCache()
    return {
      items: rows.map((r) => toPublicPhoto(r.photo, owner(r), data.locale)),
      total: total?.n ?? 0,
      page,
      pageSize: PAGE_SIZE,
      photographer: photographer ?? null,
    }
  })

/** Number of public photos per region (for the map) and per category. */
export const discoveryCounts = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDb()
  const base = (col: typeof schema.photos.regionSlug | typeof schema.photos.category) =>
    db
      .select({ key: col, n: count() })
      .from(schema.photos)
      .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
      .where(publicPhotoWhere())
      .groupBy(col)
  const [byRegion, byCategory] = await Promise.all([base(schema.photos.regionSlug), base(schema.photos.category)])
  publicCache()
  return {
    regions: Object.fromEntries(byRegion.map((r) => [r.key, r.n])),
    categories: Object.fromEntries(byCategory.map((r) => [r.key, r.n])),
    total: byRegion.reduce((s, r) => s + r.n, 0),
  }
})

/* ---------------------------------------------------------------- photo */

export const getPhoto = createServerFn({ method: 'GET' })
  .validator(z.object({ id: photoId, locale }))
  .handler(async ({ data }) => {
    const db = await getDb()
    const r = await db
      .select({ ...baseSelect, profile: schema.profiles })
      .from(schema.photos)
      .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.photos.ownerId))
      .where(publicPhotoWhere(eq(schema.photos.id, data.id)))
      .get()
    // Pending, rejected, hidden or unknown: indistinguishable 404.
    if (!r) throw notFound()
    const p = r.photo
    const related = await db
      .select(baseSelect)
      .from(schema.photos)
      .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.photos.ownerId))
      .where(
        publicPhotoWhere(
          ne(schema.photos.id, p.id),
          or(eq(schema.photos.regionSlug, p.regionSlug), eq(schema.photos.category, p.category), eq(schema.photos.ownerId, p.ownerId)),
        ),
      )
      .orderBy(desc(sql`case when ${schema.photos.regionSlug} = ${p.regionSlug} then 1 else 0 end`), desc(schema.photos.approvedAt))
      .limit(8)
    const prof = r.profile
    publicCache()
    return {
      photo: {
        ...toPublicPhoto(p, owner(r), data.locale),
        description: p.description,
        tags: p.tags,
      },
      photographer: {
        slug: prof.slug,
        displayName: prof.displayName,
        city: prof.city,
        regionSlug: prof.regionSlug,
        avatar: publicAvatar(prof),
        // Availability only — the details themselves are revealed on click.
        contact: {
          whatsapp: prof.showWhatsapp && prof.whatsapp !== '',
          email: prof.showEmail && prof.contactEmail !== '',
        },
      },
      related: related.map((x) => toPublicPhoto(x.photo, owner(x), data.locale)),
    }
  })

/* --------------------------------------------------------- photographers */

export const getPhotographer = createServerFn({ method: 'GET' })
  .validator(z.object({ slug, locale }))
  .handler(async ({ data }) => {
    const db = await getDb()
    const prof = await db
      .select({ profile: schema.profiles, status: schema.users.status, since: schema.users.createdAt })
      .from(schema.profiles)
      .innerJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
      .where(eq(schema.profiles.slug, data.slug))
      .get()
    if (!prof || prof.status !== 'active') throw notFound()
    const rows = await db
      .select(baseSelect)
      .from(schema.photos)
      .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.photos.ownerId))
      .where(publicPhotoWhere(eq(schema.photos.ownerId, prof.profile.userId)))
      .orderBy(desc(schema.photos.featured), desc(schema.photos.approvedAt))
      .limit(200)
    // Profiles become public with their first approved photograph.
    if (rows.length === 0) throw notFound()
    const p = prof.profile
    publicCache()
    return {
      userId: p.userId,
      slug: p.slug,
      displayName: p.displayName,
      bio: p.bio,
      city: p.city,
      regionSlug: p.regionSlug,
      website: p.website,
      instagram: p.instagram,
      avatar: publicAvatar(p),
      isDemo: p.isDemo,
      since: prof.since.toISOString(),
      contact: { whatsapp: p.showWhatsapp && p.whatsapp !== '', email: p.showEmail && p.contactEmail !== '' },
      photos: rows.map((r) => toPublicPhoto(r.photo, owner(r), data.locale)),
      regionsCovered: [...new Set(rows.map((r) => r.photo.regionSlug))],
    }
  })

export const listPhotographers = createServerFn({ method: 'GET' })
  .validator(z.object({ locale, featuredOnly: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const db = await getDb()
    const photos = await db
      .select({ ...baseSelect, profile: schema.profiles })
      .from(schema.photos)
      .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.photos.ownerId))
      .where(publicPhotoWhere(data.featuredOnly ? eq(schema.profiles.featured, true) : undefined))
      .orderBy(desc(schema.photos.approvedAt))
      .limit(1000)
    const byOwner = new Map<string, { profile: (typeof photos)[number]['profile']; photos: typeof photos }>()
    for (const r of photos) {
      const e = byOwner.get(r.profile.userId) ?? { profile: r.profile, photos: [] }
      e.photos.push(r)
      byOwner.set(r.profile.userId, e)
    }
    const list = [...byOwner.values()]
      .sort((a, b) => Number(b.profile.featured) - Number(a.profile.featured) || b.photos.length - a.photos.length)
      .slice(0, 60)
      .map((e) => ({
        slug: e.profile.slug,
        displayName: e.profile.displayName,
        city: e.profile.city,
        regionSlug: e.profile.regionSlug,
        bio: e.profile.bio.slice(0, 220),
        avatar: publicAvatar(e.profile),
        featured: e.profile.featured,
        isDemo: e.profile.isDemo,
        count: e.photos.length,
        samples: e.photos.slice(0, 3).map((r) => toPublicPhoto(r.photo, owner(r), data.locale)),
      }))
    publicCache()
    return list
  })

/* --------------------------------------------------------------- contact */

function formatPhone(digits: string): string {
  // Mauritanian numbers: +222 XX XX XX XX; otherwise groups of three.
  if (digits.startsWith('222') && digits.length === 11) return `+222 ${digits.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ')}`
  return `+${digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim()}`
}

/**
 * Reveals one contact channel after an explicit click. Contact details are
 * never rendered into page HTML; this endpoint is rate-limited and records
 * the click for the photographer's statistics.
 */
export const revealContact = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      slug,
      channel: z.enum(['whatsapp', 'email']),
      photoId: photoId.optional(),
      locale,
    }),
  )
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    setResponseHeader('X-Robots-Tag', 'noindex')
    const ip = requestIp()
    const limited = await consumeAll([
      { key: `contact:ip:${ip}:h`, limit: 30, windowSeconds: 3600 },
      { key: `contact:ip:${ip}:d`, limit: 100, windowSeconds: 86_400 },
      { key: `contact:ip:${ip}:${data.slug}`, limit: 6, windowSeconds: 3600 },
    ])
    if (!limited.ok) fail('rate_limited', 429)
    const db = await getDb()
    const r = await db
      .select({ profile: schema.profiles, status: schema.users.status })
      .from(schema.profiles)
      .innerJoin(schema.users, eq(schema.users.id, schema.profiles.userId))
      .where(eq(schema.profiles.slug, data.slug))
      .get()
    if (!r || r.status !== 'active') fail('not_found', 404)
    const pub = await db
      .select({ id: schema.photos.id, title: schema.photos.title })
      .from(schema.photos)
      .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
      .where(publicPhotoWhere(eq(schema.photos.ownerId, r.profile.userId), data.photoId ? eq(schema.photos.id, data.photoId) : undefined))
      .limit(1)
      .get()
    if (!pub) fail('not_found', 404)
    const p = r.profile
    const { t } = serverTranslator(data.locale)
    const title = data.photoId ? pub.title : ''
    const message = title ? t('contact.prefillPhoto', { title }) : t('contact.prefillProfile')

    await recordEvent({
      type: data.channel === 'whatsapp' ? 'contact_whatsapp' : 'contact_email',
      subjectId: data.photoId ? pub.id : p.userId,
      photographerId: p.userId,
      ip,
      userAgent: requestUserAgent(),
    })

    if (data.channel === 'whatsapp') {
      if (!p.showWhatsapp || !p.whatsapp) fail('not_found', 404)
      return {
        channel: 'whatsapp' as const,
        display: formatPhone(p.whatsapp),
        href: `https://wa.me/${p.whatsapp}?text=${encodeURIComponent(message)}`,
      }
    }
    if (!p.showEmail || !p.contactEmail) fail('not_found', 404)
    return {
      channel: 'email' as const,
      display: p.contactEmail,
      href: `mailto:${p.contactEmail}?subject=${encodeURIComponent(t('contact.mailSubject'))}&body=${encodeURIComponent(message)}`,
    }
  })

/* ---------------------------------------------------------------- tracking */

export const trackView = createServerFn({ method: 'POST' })
  .validator(z.object({ photoId: photoId.optional(), profileSlug: slug.optional() }))
  .handler(async ({ data }) => {
    setResponseHeader('Cache-Control', 'no-store')
    const ip = requestIp()
    const ok = await consumeAll([{ key: `track:ip:${ip}`, limit: 600, windowSeconds: 3600 }])
    if (!ok.ok) return { ok: false }
    const db = await getDb()
    if (data.photoId) {
      const p = await db
        .select({ id: schema.photos.id, ownerId: schema.photos.ownerId })
        .from(schema.photos)
        .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
        .where(publicPhotoWhere(eq(schema.photos.id, data.photoId)))
        .get()
      if (p) await recordEvent({ type: 'photo_view', subjectId: p.id, photographerId: p.ownerId, ip, userAgent: requestUserAgent() })
    } else if (data.profileSlug) {
      const prof = await db
        .select({ userId: schema.profiles.userId })
        .from(schema.profiles)
        .where(eq(schema.profiles.slug, data.profileSlug))
        .get()
      if (prof)
        await recordEvent({ type: 'profile_view', subjectId: prof.userId, photographerId: prof.userId, ip, userAgent: requestUserAgent() })
    }
    return { ok: true }
  })

/* ---------------------------------------------------------------- reports */

export const reportPhoto = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      photoId,
      reason: z.enum(REPORT_REASONS),
      details: z.string().max(2000).default('').transform(cleanMultiline),
    }),
  )
  .handler(async ({ data }) => {
    const ip = requestIp()
    const limited = await consumeAll([
      { key: `report:ip:${ip}:h`, limit: 8, windowSeconds: 3600 },
      { key: `report:ip:${ip}:d`, limit: 30, windowSeconds: 86_400 },
    ])
    if (!limited.ok) fail('rate_limited', 429)
    const db = await getDb()
    const p = await db
      .select({ id: schema.photos.id })
      .from(schema.photos)
      .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
      .where(publicPhotoWhere(eq(schema.photos.id, data.photoId)))
      .get()
    if (!p) fail('not_found', 404)
    const hash = await visitorHash(ip, requestUserAgent())
    // One open report per visitor per photo counts towards auto-hide.
    const dup = await db
      .select({ id: schema.reports.id })
      .from(schema.reports)
      .where(and(eq(schema.reports.photoId, p.id), eq(schema.reports.reporterHash, hash), eq(schema.reports.status, 'open')))
      .get()
    if (dup && data.reason !== 'csam') return { ok: true as const }
    await createReport({ photoId: p.id, reason: data.reason, details: data.details, reporterHash: hash, source: 'button' })
    return { ok: true as const }
  })

/* ----------------------------------------------------------------- misc */

export const regionsWithSamples = createServerFn({ method: 'GET' })
  .validator(z.object({ locale }))
  .handler(async ({ data }) => {
    const db = await getDb()
    const rows = await db
      .select(baseSelect)
      .from(schema.photos)
      .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.photos.ownerId))
      .where(publicPhotoWhere(inArray(schema.photos.regionSlug, regions.map((r) => r.slug))))
      .orderBy(desc(schema.photos.featured), desc(schema.photos.approvedAt))
      .limit(400)
    const out: Record<string, { count: number; sample: ReturnType<typeof toPublicPhoto> | null }> = {}
    for (const r of regions) out[r.slug] = { count: 0, sample: null }
    for (const r of rows) {
      const e = out[r.photo.regionSlug]
      if (!e) continue
      e.count++
      e.sample ??= toPublicPhoto(r.photo, owner(r), data.locale)
    }
    publicCache()
    return out
  })

/* ----------------------------------------------------------------- home */

/** Everything the home page needs in one round-trip. Works with zero photos. */
export const getHome = createServerFn({ method: 'GET' })
  .validator(z.object({ locale }))
  .handler(async ({ data }) => {
    ensureWorker()
    const db = await getDb()
    const featured = await db
      .select(baseSelect)
      .from(schema.photos)
      .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.photos.ownerId))
      .where(publicPhotoWhere())
      .orderBy(desc(schema.photos.featured), desc(schema.photos.approvedAt))
      .limit(9)
    const all = await db
      .select({ region: schema.photos.regionSlug, category: schema.photos.category, ownerId: schema.photos.ownerId })
      .from(schema.photos)
      .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
      .where(publicPhotoWhere())
    const regionCounts: Record<string, number> = {}
    const categoryCounts: Record<string, number> = {}
    for (const r of all) {
      regionCounts[r.region] = (regionCounts[r.region] ?? 0) + 1
      categoryCounts[r.category] = (categoryCounts[r.category] ?? 0) + 1
    }
    // One sample per region for the map panel.
    const samples = await db
      .select(baseSelect)
      .from(schema.photos)
      .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
      .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.photos.ownerId))
      .where(publicPhotoWhere())
      .orderBy(desc(schema.photos.featured), desc(schema.photos.approvedAt))
      .limit(300)
    const regionSamples: Record<string, ReturnType<typeof toPublicPhoto>> = {}
    for (const r of samples) regionSamples[r.photo.regionSlug] ??= toPublicPhoto(r.photo, owner(r), data.locale)

    const owners = new Map<string, number>()
    for (const r of all) owners.set(r.ownerId, (owners.get(r.ownerId) ?? 0) + 1)
    const profs = owners.size
      ? await db
          .select()
          .from(schema.profiles)
          .where(inArray(schema.profiles.userId, [...owners.keys()]))
      : []
    const photographers = profs
      .sort((a, b) => Number(b.featured) - Number(a.featured) || (owners.get(b.userId) ?? 0) - (owners.get(a.userId) ?? 0))
      .slice(0, 4)
      .map((p) => ({
        slug: p.slug,
        displayName: p.displayName,
        city: p.city,
        regionSlug: p.regionSlug,
        bio: p.bio.slice(0, 160),
        avatar: publicAvatar(p),
        count: owners.get(p.userId) ?? 0,
        isDemo: p.isDemo,
      }))
    publicCache()
    return {
      featured: featured.map((r) => toPublicPhoto(r.photo, owner(r), data.locale)),
      regionCounts,
      categoryCounts,
      regionSamples,
      photographers,
      totals: { photos: all.length, photographers: owners.size, regions: Object.keys(regionCounts).length },
    }
  })

/* ------------------------------------------------------------- takedown */

export const submitTakedown = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.string().trim().min(2).max(100),
      email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254)),
      photoUrl: z.string().trim().max(500).default(''),
      reason: z.enum(REPORT_REASONS),
      details: z.string().max(4000).transform(cleanMultiline).pipe(z.string().min(10)),
      goodFaith: z.literal(true),
    }),
  )
  .handler(async ({ data }) => {
    const ip = requestIp()
    const limited = await consumeAll([
      { key: `takedown:ip:${ip}:h`, limit: 5, windowSeconds: 3600 },
      { key: `takedown:ip:${ip}:d`, limit: 20, windowSeconds: 86_400 },
    ])
    if (!limited.ok) fail('rate_limited', 429)
    const segment = /\/photos\/([a-z0-9-]+)/.exec(data.photoUrl)?.[1] ?? ''
    const id = segment ? idFromSegment(segment) : null
    const db = await getDb()
    const photo = id ? await db.select({ id: schema.photos.id }).from(schema.photos).where(eq(schema.photos.id, id)).get() : undefined
    await createReport({
      photoId: photo?.id ?? null,
      reason: data.reason,
      details: data.details,
      reporterHash: await visitorHash(ip, requestUserAgent()),
      source: 'takedown_form',
      reporterName: data.name,
      reporterEmail: data.email,
      photoUrl: data.photoUrl,
    })
    return { ok: true as const }
  })
