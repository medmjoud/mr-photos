/**
 * Demo content for local development and design review.
 *
 *   ALLOW_DEMO_SEED=true npm run seed:demo          # create
 *   ALLOW_DEMO_SEED=true npm run seed:demo:remove   # delete everything marked demo
 *
 * Safety: refuses to run in production/staging, against a non-local database,
 * or without ALLOW_DEMO_SEED=true. Images are generated procedurally here
 * (abstract landscapes — no third-party photographs, so no licensing issue),
 * every record is flagged is_demo, and the site shows a "demo content" banner
 * while any demo photo exists. Photographer names are obviously fictitious.
 */
import { randomBytes } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import sharp from 'sharp'
import { env } from '../src/server/env'
import { getDb, schema } from '../src/server/db/client'
import { hashPassword } from '../src/server/auth/password'
import { newId, sha256Hex } from '../src/server/crypto'
import { storage, deleteKeys } from '../src/server/storage'
import { processPhoto } from '../src/server/jobs/photos'
import { buildSearchText } from '../src/server/search'
import { orientationOf } from '../src/lib/categories'

const e = env()
if (e.isProduction) fail('refusing to seed demo data: APP_ENV is production/staging')
if (!e.ALLOW_DEMO_SEED) fail('refusing to seed demo data: set ALLOW_DEMO_SEED=true')
if (!e.DATABASE_URL.startsWith('file:')) fail('refusing to seed demo data into a non-local database')

function fail(msg: string): never {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

const db = await getDb()

if (process.argv.includes('--remove')) {
  const demoUsers = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.isDemo, true))
  const ids = demoUsers.map((u) => u.id)
  if (ids.length) {
    const photos = await db.select().from(schema.photos).where(inArray(schema.photos.ownerId, ids))
    await deleteKeys(photos.flatMap((p) => [p.originalKey, ...p.variants.map((v) => v.key)]))
    await db.delete(schema.users).where(inArray(schema.users.id, ids))
  }
  console.info(`✓ removed ${ids.length} demo accounts and their photos`)
  process.exit(0)
}

/* ----------------------------------------------------------- generator */

let seed = 20261104
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

type Scene = 'dunes' | 'coast' | 'night' | 'plateau' | 'town'

function svgScene(scene: Scene, w: number, h: number, hue: number): string {
  const sky = {
    dunes: ['#1d2742', '#a0533a', '#f2a65e'],
    coast: ['#163a4a', '#5f9ea0', '#e9d2b0'],
    night: ['#05070d', '#0f1a33', '#1f2b4a'],
    plateau: ['#2a3350', '#c97b4a', '#f0c48a'],
    town: ['#22263a', '#b5643a', '#f3c27a'],
  }[scene]
  const layers: Array<string> = []
  if (scene === 'night') {
    for (let i = 0; i < 260; i++) {
      const r = rnd() * 1.6 + 0.3
      layers.push(`<circle cx="${(rnd() * w).toFixed(0)}" cy="${(rnd() * h * 0.7).toFixed(0)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(0.3 + rnd() * 0.7).toFixed(2)}"/>`)
    }
    layers.push(`<ellipse cx="${w * 0.6}" cy="${h * 0.25}" rx="${w * 0.5}" ry="${h * 0.08}" fill="#8aa0d0" opacity="0.08" transform="rotate(-18 ${w * 0.6} ${h * 0.25})"/>`)
  } else {
    layers.push(`<circle cx="${w * (0.25 + rnd() * 0.5)}" cy="${h * (0.3 + rnd() * 0.15)}" r="${Math.min(w, h) * 0.07}" fill="#ffe2b8" opacity="0.92"/>`)
  }
  const ground = {
    dunes: ['#c9824f', '#a8603a', '#7d4228', '#5a2e1c'],
    coast: ['#d9c29c', '#3c7f80', '#2a5d61', '#c7a77c'],
    night: ['#151a26', '#0d111a'],
    plateau: ['#9a4f2d', '#7a3d24', '#5b2b19'],
    town: ['#7a4a2e', '#5c3622'],
  }[scene]
  if (scene === 'coast') {
    layers.push(`<rect y="${h * 0.55}" width="${w}" height="${h * 0.45}" fill="${ground[1]}"/>`)
    for (let i = 0; i < 9; i++) {
      const y = h * (0.57 + i * 0.03)
      layers.push(`<rect y="${y.toFixed(0)}" width="${w}" height="${(h * 0.004).toFixed(0)}" fill="#e8f2ee" opacity="${(0.05 + rnd() * 0.12).toFixed(2)}"/>`)
    }
    layers.push(`<path d="M0 ${h * 0.82} C ${w * 0.35} ${h * 0.74}, ${w * 0.6} ${h * 0.9}, ${w} ${h * 0.8} L ${w} ${h} L 0 ${h} Z" fill="${ground[0]}"/>`)
  } else if (scene === 'plateau') {
    for (let i = 0; i < 3; i++) {
      const top = h * (0.48 + i * 0.12)
      const x0 = w * (rnd() * 0.3 - 0.1)
      const x1 = x0 + w * (0.5 + rnd() * 0.4)
      layers.push(`<path d="M${x0 - w * 0.1} ${h} L${x0} ${top} L${x1} ${top} L${x1 + w * 0.08} ${h} Z" fill="${ground[i % ground.length]}" opacity="${0.75 + i * 0.1}"/>`)
    }
  } else if (scene === 'town') {
    let x = 0
    while (x < w) {
      const bw = w * (0.04 + rnd() * 0.08)
      const bh = h * (0.12 + rnd() * 0.22)
      layers.push(`<rect x="${x.toFixed(0)}" y="${(h * 0.78 - bh).toFixed(0)}" width="${bw.toFixed(0)}" height="${(bh + h * 0.3).toFixed(0)}" fill="${ground[Math.floor(rnd() * 2)]}"/>`)
      if (rnd() > 0.5) layers.push(`<rect x="${(x + bw * 0.4).toFixed(0)}" y="${(h * 0.78 - bh + bh * 0.3).toFixed(0)}" width="${(bw * 0.18).toFixed(0)}" height="${(bh * 0.2).toFixed(0)}" fill="#ffd79a" opacity="0.7"/>`)
      x += bw + w * 0.004
    }
    layers.push(`<rect y="${h * 0.86}" width="${w}" height="${h * 0.14}" fill="#3e2617"/>`)
  } else {
    for (let i = 0; i < ground.length; i++) {
      const base = h * (0.6 + i * 0.1)
      const a = h * (0.06 + rnd() * 0.08)
      layers.push(
        `<path d="M0 ${base} C ${w * 0.25} ${base - a}, ${w * 0.5} ${base + a}, ${w * 0.75} ${base - a * 0.6} S ${w} ${base}, ${w} ${base} L ${w} ${h} L 0 ${h} Z" fill="${ground[i]}"/>`,
      )
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="0.6" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/></linearGradient><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${hue}"/><feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.06 0"/></filter></defs><rect width="100%" height="100%" fill="url(#s)"/>${layers.join('')}<rect width="100%" height="100%" filter="url(#g)"/></svg>`
}

const photographers = [
  { name: 'Photographe démo — Atar', city: 'Atar', region: 'adrar' },
  { name: 'Photographe démo — Nouadhibou', city: 'Nouadhibou', region: 'dakhlet-nouadhibou' },
  { name: 'Photographe démo — Kiffa', city: 'Kiffa', region: 'assaba' },
  { name: 'Photographe démo — Nouakchott', city: 'Nouakchott', region: 'nouakchott' },
]

const photos: Array<{ p: number; title: string; region: string; category: string; scene: Scene; portrait?: boolean; tags: Array<string> }> = [
  { p: 0, title: 'Démo — Dunes au crépuscule', region: 'adrar', category: 'landscapes', scene: 'dunes', tags: ['dunes', 'crépuscule'] },
  { p: 0, title: 'Démo — Plateau de grès', region: 'adrar', category: 'landscapes', scene: 'plateau', tags: ['grès', 'plateau'] },
  { p: 0, title: 'Démo — Ciel étoilé', region: 'adrar', category: 'night-sky', scene: 'night', portrait: true, tags: ['étoiles', 'nuit'] },
  { p: 1, title: 'Démo — Ligne d’horizon atlantique', region: 'dakhlet-nouadhibou', category: 'coast', scene: 'coast', tags: ['océan', 'horizon'] },
  { p: 1, title: 'Démo — Plage au matin', region: 'dakhlet-nouadhibou', category: 'coast', scene: 'coast', portrait: true, tags: ['plage'] },
  { p: 1, title: 'Démo — Nuit sur le littoral', region: 'inchiri', category: 'night-sky', scene: 'night', tags: ['nuit'] },
  { p: 2, title: 'Démo — Massif au couchant', region: 'assaba', category: 'landscapes', scene: 'plateau', tags: ['massif'] },
  { p: 2, title: 'Démo — Erg du sud', region: 'tagant', category: 'landscapes', scene: 'dunes', portrait: true, tags: ['erg'] },
  { p: 2, title: 'Démo — Dunes de l’est', region: 'hodh-ech-chargui', category: 'landscapes', scene: 'dunes', tags: ['dunes'] },
  { p: 3, title: 'Démo — Quartier au soir', region: 'nouakchott', category: 'cities', scene: 'town', tags: ['ville', 'soir'] },
  { p: 3, title: 'Démo — Toits de la ville', region: 'nouakchott', category: 'cities', scene: 'town', portrait: true, tags: ['ville'] },
  { p: 3, title: 'Démo — Côte au large de la capitale', region: 'nouakchott', category: 'coast', scene: 'coast', tags: ['océan'] },
  { p: 3, title: 'Démo — Dunes du Trarza', region: 'trarza', category: 'landscapes', scene: 'dunes', tags: ['dunes'] },
]

const userIds: Array<string> = []
for (const [i, ph] of photographers.entries()) {
  const id = newId()
  userIds.push(id)
  await db.insert(schema.users).values({
    id,
    email: `demo${i + 1}-${newId(6)}@demo.soura.invalid`,
    passwordHash: await hashPassword(randomBytes(24).toString('hex')),
    emailVerifiedAt: new Date(),
    isDemo: true,
  })
  await db.insert(schema.profiles).values({
    userId: id,
    slug: `demo-${ph.city.toLowerCase()}-${newId(4)}`,
    displayName: ph.name,
    bio: 'Profil de démonstration : images générées automatiquement pour tester la mise en page. Aucun photographe réel.',
    regionSlug: ph.region,
    city: ph.city,
    featured: i < 2,
    isDemo: true,
  })
}

let n = 0
for (const item of photos) {
  const [w, h] = item.portrait ? [1800, 2400] : [2600, 1700]
  const buf = await sharp(Buffer.from(svgScene(item.scene, w, h, n + 3))).jpeg({ quality: 88 }).toBuffer()
  const id = newId()
  const key = `originals/${id}/${newId(20)}.jpg`
  await storage().put(key, buf, 'image/jpeg')
  const meta = {
    title: item.title,
    description: 'Image de démonstration générée automatiquement — elle ne représente pas un lieu réel.',
    tags: [...item.tags, 'démo'],
    locationText: '',
    authorName: photographers[item.p].name,
    regionSlug: item.region,
    category: item.category,
  }
  await db.insert(schema.photos).values({
    id,
    ownerId: userIds[item.p],
    ...meta,
    yearTaken: 2025,
    hasPeople: false,
    hasMinor: false,
    confirmedRights: true,
    confirmedConsent: true,
    confirmedRules: true,
    status: 'pending',
    width: w,
    height: h,
    orientation: orientationOf(w, h),
    originalKey: key,
    originalMime: 'image/jpeg',
    originalBytes: buf.length,
    originalSha256: sha256Hex(buf),
    publicToken: newId(12),
    searchText: buildSearchText(meta),
    isDemo: true,
  })
  await processPhoto(id)
  await db
    .update(schema.photos)
    .set({
      status: 'approved',
      approvedAt: new Date(Date.now() - n * 3_600_000),
      altFr: `Image de démonstration : ${item.title.replace('Démo — ', '').toLowerCase()}, paysage abstrait généré.`,
      altEn: 'Demo image: generated abstract landscape.',
      altAr: 'صورة تجريبية: منظر تجريدي مولَّد.',
      featured: n < 4,
    })
    .where(eq(schema.photos.id, id))
  await db.insert(schema.moderationLog).values({ actorId: null, action: 'demo_seed', targetType: 'photo', targetId: id })
  n++
  process.stdout.write(`\r  ${n}/${photos.length} demo photos`)
}
console.info(`\n✓ demo content created (${photographers.length} photographers, ${photos.length} photos). Remove with: ALLOW_DEMO_SEED=true npm run seed:demo:remove`)
process.exit(0)
