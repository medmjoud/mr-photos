import { desc, eq } from 'drizzle-orm'
import { getDb, schema } from './db/client'
import { env } from './env'
import { publicPhotoWhere } from './public'
import { defaultLocale, localeTags, locales } from '@/i18n/config'
import { photoMediaPath } from '@/lib/media'
import { photoSegment } from '@/lib/text'

const STATIC_PATHS = ['', '/explore', '/photographers', '/about', '/for-photographers', '/content-rules', '/terms', '/privacy', '/report']

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Only publicly visible content ever appears here (pending/rejected/hidden never do). */
export async function buildSitemap(): Promise<string> {
  const base = env().APP_URL.replace(/\/$/, '')
  const db = await getDb()
  const photos = await db
    .select({ photo: schema.photos })
    .from(schema.photos)
    .innerJoin(schema.users, eq(schema.users.id, schema.photos.ownerId))
    .where(publicPhotoWhere())
    .orderBy(desc(schema.photos.approvedAt))
    .limit(40_000)
  const owners = new Set(photos.map((p) => p.photo.ownerId))
  const profiles = owners.size ? await db.select({ userId: schema.profiles.userId, slug: schema.profiles.slug }).from(schema.profiles) : []
  const regionsWithPhotos = [...new Set(photos.map((p) => p.photo.regionSlug))]

  type Entry = { path: string; lastmod?: Date; image?: { loc: string; title: string } }
  const entries: Array<Entry> = [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...regionsWithPhotos.map((r) => ({ path: `/explore?region=${r}` })),
    ...profiles.filter((p) => owners.has(p.userId)).map((p) => ({ path: `/photographers/${p.slug}` })),
    ...photos.map(({ photo }) => {
      const og = photo.variants.find((v) => v.kind === 'og')
      return {
        path: `/photos/${photoSegment(photo.title, photo.id)}`,
        lastmod: photo.approvedAt ?? photo.updatedAt,
        image: og ? { loc: `${base}${photoMediaPath(photo.id, photo.publicToken, 'og', og.width, 'jpeg')}`, title: photo.title } : undefined,
      }
    }),
  ]

  const urls = entries.flatMap((e) =>
    locales.map((l) => {
      const alternates = [
        ...locales.map((a) => `<xhtml:link rel="alternate" hreflang="${localeTags[a]}" href="${esc(`${base}/${a}${e.path}`)}"/>`),
        `<xhtml:link rel="alternate" hreflang="x-default" href="${esc(`${base}/${defaultLocale}${e.path}`)}"/>`,
      ].join('')
      const lastmod = e.lastmod ? `<lastmod>${e.lastmod.toISOString()}</lastmod>` : ''
      const image = e.image ? `<image:image><image:loc>${esc(e.image.loc)}</image:loc><image:title>${esc(e.image.title)}</image:title></image:image>` : ''
      return `<url><loc>${esc(`${base}/${l}${e.path}`)}</loc>${lastmod}${alternates}${image}</url>`
    }),
  )
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls.join('')}</urlset>`
}

export function buildRobots(): string {
  const e = env()
  const base = e.APP_URL.replace(/\/$/, '')
  if (e.APP_ENV === 'staging') return 'User-agent: *\nDisallow: /\n'
  const privateAreas = locales.flatMap((l) => [`Disallow: /${l}/dashboard`, `Disallow: /${l}/admin`, `Disallow: /${l}/auth`])
  return ['User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /files/', 'Disallow: /_serverFn/', ...privateAreas, 'Disallow: /*?q=', '', `Sitemap: ${base}/sitemap.xml`, ''].join('\n')
}
