import { expect, test } from '@playwright/test'
import {
  ADMIN,
  approveAsAdmin,
  fillProfileContacts,
  login,
  makeTestJpeg,
  photoByTitle,
  signUpAndVerify,
  sql,
  uniqueEmail,
  uploadPhoto,
  waitForProcessing,
} from './helpers'

const PASSWORD = 'mot de passe photographe'

test.describe('public gallery, contact and reports', () => {
  test('approved photos are browsable; contact details never appear before a click', async ({ browser }) => {
    const stamp = Date.now()
    const title = `Guelta publique ${stamp}`
    const pendingTitle = `Guelta en attente ${stamp}`
    const phone = '+222 41 98 76 54'
    const phoneDigits = '22241987654'
    const contactEmail = `contact-${stamp}@exemple.mr`

    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await signUpAndVerify(page, { name: `Aminetou ${stamp}`, email: uniqueEmail(), password: PASSWORD })
    await fillProfileContacts(page, phone, contactEmail)
    await uploadPhoto(page, await makeTestJpeg(`pub-${stamp}`), title)
    await uploadPhoto(page, await makeTestJpeg(`pend-${stamp}`, 2100, 1400), pendingTitle)
    const photo = await waitForProcessing(title)
    const pending = await waitForProcessing(pendingTitle)

    const admin = await browser.newContext()
    const aPage = await admin.newPage()
    await login(aPage, ADMIN.email, ADMIN.password)
    await approveAsAdmin(aPage, photo.id)

    const visitor = await browser.newContext()
    const v = await visitor.newPage()
    await v.goto('/fr/explore?region=adrar')
    await expect(v.getByRole('link', { name: new RegExp(title) })).toBeVisible()
    await v.getByRole('link', { name: new RegExp(title) }).click()
    await expect(v.getByRole('heading', { level: 1, name: title })).toBeVisible()

    // Pending photo page: 404, and never listed.
    const pendingRes = await visitor.request.get(`/fr/photos/x-${pending.id}`)
    expect(pendingRes.status()).toBe(404)
    await v.goto(`/fr/explore?q=${encodeURIComponent(pendingTitle)}`)
    await expect(v.getByText('Aucune photo ne correspond.')).toBeVisible()

    // Page source (SSR HTML + dehydrated state) contains no contact details.
    const photoUrl = `/fr/photos/${(await sql('select id from photos where id = ?', [photo.id]))[0].id as string}`
    const html = await (await visitor.request.get(photoUrl, { maxRedirects: 5 })).text()
    const slug = (await sql('select p.slug from profiles p join photos ph on ph.owner_id = p.user_id where ph.id = ?', [photo.id]))[0]
      .slug as string
    const profileHtml = await (await visitor.request.get(`/fr/photographers/${slug}`)).text()
    for (const source of [html, profileHtml]) {
      expect(source).not.toContain(phoneDigits)
      expect(source).not.toContain('41 98 76 54')
      expect(source).not.toContain(contactEmail)
    }

    // Reveal after a click.
    await v.goto(`/fr/photographers/${slug}`)
    await v.getByRole('button', { name: /Afficher le numéro WhatsApp/ }).click()
    await expect(v.getByText('+222 41 98 76 54')).toBeVisible()
    await expect(v.getByRole('link', { name: /Ouvrir WhatsApp/ })).toHaveAttribute('href', new RegExp(`^https://wa\\.me/${phoneDigits}\\?text=`))
    await v.getByRole('button', { name: /Afficher l’adresse e-mail/ }).click()
    await expect(v.getByText(contactEmail)).toBeVisible()

    // The photographer sees the contact in their totals.
    await page.goto('/fr/dashboard')
    await expect(page.getByText('Demandes de contact').locator('..').getByText(/^[1-9]/)).toBeVisible()

    await Promise.all([ctx.close(), admin.close(), visitor.close()])
  })

  test('repeated reports hide a photo automatically; an urgent report hides it at once', async ({ browser }) => {
    const stamp = Date.now()
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await signUpAndVerify(page, { name: `Sidi ${stamp}`, email: uniqueEmail('rep'), password: PASSWORD })
    await uploadPhoto(page, await makeTestJpeg(`rep-${stamp}`), `Signalée ${stamp}`)
    await uploadPhoto(page, await makeTestJpeg(`urg-${stamp}`, 2050, 1400), `Urgente ${stamp}`)
    const reported = await waitForProcessing(`Signalée ${stamp}`)
    const urgent = await waitForProcessing(`Urgente ${stamp}`)
    const admin = await browser.newContext()
    const aPage = await admin.newPage()
    await login(aPage, ADMIN.email, ADMIN.password)
    await approveAsAdmin(aPage, reported.id)
    await approveAsAdmin(aPage, urgent.id)

    async function report(id: string, reason: RegExp, ua: string) {
      const c = await browser.newContext({ userAgent: ua })
      const p = await c.newPage()
      await p.goto(`/fr/photos/x-${id}`)
      await p.getByRole('button', { name: 'Signaler' }).click()
      await p.getByRole('radio', { name: reason }).check()
      await p.getByRole('button', { name: 'Envoyer le signalement' }).click()
      await expect(p.getByText('Merci. Notre équipe va examiner ce signalement.')).toBeVisible()
      await c.close()
    }

    // Threshold is 2 distinct reporters in the e2e server.
    await report(reported.id, /Photo volée/, 'Mozilla/5.0 (X11; Linux x86_64) Reporter-One Chrome/130')
    expect((await photoByTitle(`Signalée ${stamp}`))!.hidden_at).toBeNull()
    await report(reported.id, /Photo volée/, 'Mozilla/5.0 (X11; Linux x86_64) Reporter-Two Chrome/130')
    expect((await photoByTitle(`Signalée ${stamp}`))!.hidden_at).not.toBeNull()
    expect((await admin.request.get(`/fr/photos/x-${reported.id}`)).status()).toBe(404)
    const tok = (await photoByTitle(`Signalée ${stamp}`))!.public_token
    expect((await admin.request.get(`/media/p/${reported.id}/${tok}/thumb-480.webp`)).status()).toBe(404)

    // Urgent: one report is enough.
    const aiBefore = (await photoByTitle(`Urgente ${stamp}`))!.ai_status
    await report(urgent.id, /Abus sexuel sur mineur/, 'Mozilla/5.0 (X11; Linux x86_64) Reporter-Three Chrome/130')
    expect((await photoByTitle(`Urgente ${stamp}`))!.hidden_at).not.toBeNull()

    // Owner cannot delete evidence while the urgent report is open.
    await page.goto('/fr/dashboard')
    const row = page.locator('li', { hasText: `Urgente ${stamp}` })
    await expect(row.getByRole('button', { name: 'Supprimer' })).toHaveCount(0)

    // Admin runs the child-safety procedure.
    await aPage.goto(`/fr/admin/review/${urgent.id}`)
    await aPage.getByRole('button', { name: /Procédure : suspicion/ }).click()
    await aPage.getByLabel('Tapez CSAM pour confirmer').fill('CSAM')
    await aPage.getByRole('button', { name: 'Lancer la procédure' }).click()
    await aPage.waitForURL(/child-safety\?ref=/)
    await expect(aPage.getByText('Procédure appliquée')).toBeVisible()

    const locked = (await sql('select * from photos where id = ?', [urgent.id]))[0]
    expect(locked.csam_locked_at).not.toBeNull()
    expect(locked.legal_hold).toBe(1)
    expect(locked.status).toBe('removed')
    expect(locked.variants).toBe('[]')
    expect(String(locked.original_key)).toMatch(/^restricted\//)
    // The AI provider is never called again for locked material.
    expect(locked.ai_status).toBe(aiBefore)
    const owner = (await sql('select status, suspended_reason from users where id = ?', [locked.owner_id as string]))[0]
    expect(owner.status).toBe('suspended')
    expect(owner.suspended_reason).toBe('csam_procedure')
    // Staff cannot browse it: no preview, no original link.
    await aPage.goto(`/fr/admin/review/${urgent.id}`)
    await expect(aPage.getByRole('link', { name: 'Télécharger l’original' })).toHaveCount(0)
    await expect(aPage.locator('img[src*="/files/"]')).toHaveCount(0)
    // The suspended photographer is signed out.
    await page.goto('/fr/dashboard')
    await expect(page).toHaveURL(/auth\/login/)

    await Promise.all([ctx.close(), admin.close()])
  })
})
