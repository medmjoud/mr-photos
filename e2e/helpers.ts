import { readdirSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createClient } from '@libsql/client'
import sharp from 'sharp'
import { expect, type Page } from '@playwright/test'

export const E2E_ROOT = resolve(process.cwd(), '.data/e2e')
export const ADMIN = { email: 'admin@e2e.test', password: 'admin-e2e-password' }

export function db() {
  return createClient({ url: `file:${E2E_ROOT}/soura.db` })
}

export function lastMailTo(to: string): { subject: string; text: string } | null {
  const dir = join(E2E_ROOT, 'mail')
  if (!existsSync(dir)) return null
  const mails = readdirSync(dir)
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as { to: string; subject: string; text: string })
    .filter((m) => m.to === to)
  return mails.at(-1) ?? null
}

export function uniqueEmail(prefix = 'photographer') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`
}

/** Synthetic landscape JPEG carrying EXIF and GPS, to prove stripping. */
export async function makeTestJpeg(name: string, width = 2400, height = 1600): Promise<string> {
  const dir = join(E2E_ROOT, 'fixtures')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${name}.jpg`)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22304f"/><stop offset="1" stop-color="#d98a52"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${width * 0.7}" cy="${height * 0.35}" r="${height * 0.08}" fill="#ffd9a8"/></svg>`
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .withExif({
      IFD0: { Make: 'E2ECam', Model: 'Test', Artist: 'Private Person' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '18/1 5/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '15/1 58/1 0/1' },
    })
    .toFile(file)
  return file
}

export async function signUpAndVerify(page: Page, opts: { name: string; email: string; password: string }) {
  await page.goto('/fr/auth/signup')
  await page.getByLabel('Nom affiché').fill(opts.name)
  await page.getByLabel('Adresse e-mail').fill(opts.email)
  await page.getByLabel('Mot de passe').fill(opts.password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await page.waitForURL(/check-email/)
  const mail = lastMailTo(opts.email)
  expect(mail, 'verification email').not.toBeNull()
  const link = /https?:\/\/\S+\/auth\/verify\?token=\S+/.exec(mail!.text)![0]
  await page.goto(new URL(link).pathname + new URL(link).search)
  await page.getByRole('button', { name: 'Continuer' }).click()
  await expect(page.getByText('Adresse confirmée')).toBeVisible()
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/fr/auth/login')
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL(/\/fr\/(dashboard|admin)/)
}

export async function uploadPhoto(page: Page, file: string, title: string, extra: { minor?: boolean } = {}) {
  await page.goto('/fr/dashboard/upload')
  await page.locator('input[type="file"]').setInputFiles(file)
  await page.getByLabel('Titre').fill(title)
  await page.getByLabel('Région').selectOption('adrar')
  await page.getByLabel('Catégorie').selectOption('landscapes')
  await page.getByLabel('Lieu précis').fill('Chinguetti')
  await page.getByRole('group', { name: /personnes identifiables/ }).getByLabel(extra.minor ? 'Oui' : 'Non').check()
  await page.getByRole('group', { name: /mineur/ }).getByLabel(extra.minor ? 'Oui' : 'Non').check()
  for (const cb of await page.getByRole('checkbox').all()) await cb.check()
  await page.getByRole('button', { name: 'Envoyer pour vérification' }).click()
  await expect(page.getByText('Photo reçue')).toBeVisible()
}

export async function photoByTitle(title: string) {
  const c = db()
  const r = await c.execute({ sql: 'select * from photos where title = ?', args: [title] })
  c.close()
  return r.rows[0] as unknown as {
    id: string
    status: string
    processing: string
    ai_status: string
    public_token: string
    original_key: string
    variants: string
    hidden_at: number | null
  } | undefined
}

export async function waitForProcessing(title: string) {
  await expect
    .poll(async () => (await photoByTitle(title))?.processing, { timeout: 30_000 })
    .toBe('ready')
  await expect
    .poll(async () => (await photoByTitle(title))?.ai_status, { timeout: 30_000 })
    .not.toBe('not_run')
  return (await photoByTitle(title))!
}
