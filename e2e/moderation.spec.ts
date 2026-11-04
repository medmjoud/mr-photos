import exifr from 'exifr'
import { expect, test, type Request } from '@playwright/test'
import {
  ADMIN,
  login,
  makeTestJpeg,
  photoByTitle,
  signUpAndVerify,
  uniqueEmail,
  uploadPhoto,
  waitForProcessing,
} from './helpers'

const PASSWORD = 'mot de passe photographe'

test.describe('upload → moderation → publication', () => {
  test('pending photos stay private; only an admin can approve; public images carry no EXIF/GPS', async ({
    browser,
    baseURL,
  }) => {
    const stamp = Date.now()
    const titleA = `Dunes témoin A ${stamp}`
    const titleB = `Dunes témoin B ${stamp}`
    const email = uniqueEmail()
    const file = await makeTestJpeg(`moderation-${stamp}`)

    // Photographer signs up and uploads two photos.
    const photographer = await browser.newContext()
    const pPage = await photographer.newPage()
    await signUpAndVerify(pPage, { name: 'Photographe Test', email, password: PASSWORD })
    await uploadPhoto(pPage, file, titleA)
    const fileB = await makeTestJpeg(`moderation-b-${stamp}`, 2000, 1400)
    await uploadPhoto(pPage, fileB, titleB)
    const a = await waitForProcessing(titleA)
    const b = await waitForProcessing(titleB)
    expect(a.status).toBe('pending')

    // Pending: no public media, no original without a valid signature.
    const anon = await browser.newContext()
    for (const f of ['thumb-480.webp', 'thumb-960.avif', 'preview-1600.webp', 'og-1200.jpeg']) {
      const r = await anon.request.get(`/media/p/${a.id}/${a.public_token}/${f}`)
      expect(r.status(), `pending ${f}`).toBe(404)
    }
    expect((await anon.request.get(`/files/${a.original_key}`)).status()).toBe(403)
    expect((await anon.request.get(`/files/${a.original_key}?exp=9999999999&sig=deadbeef`)).status()).toBe(403)
    const reviewKey = (JSON.parse(a.variants) as Array<{ kind: string; key: string }>).find((v) => v.kind === 'review')!.key
    expect((await anon.request.get(`/files/${reviewKey}`)).status()).toBe(403)
    expect((await anon.request.get(`/media/p/${a.id}/${a.public_token}/review-2048.webp`)).status()).toBe(404)

    // A photographer cannot reach any admin route.
    for (const path of ['/fr/admin', '/fr/admin/review', `/fr/admin/review/${a.id}`, '/fr/admin/users', '/fr/admin/log']) {
      const res = await pPage.goto(path)
      expect(res?.status(), path).toBe(404)
    }

    // Admin approves photo A — capture the RPC so we can replay it.
    const admin = await browser.newContext()
    const aPage = await admin.newPage()
    await login(aPage, ADMIN.email, ADMIN.password)
    await aPage.goto(`/fr/admin/review/${a.id}`)
    await expect(aPage.getByRole('heading', { name: titleA })).toBeVisible()
    await aPage.getByLabel('Texte alternatif (français)').fill('Dunes orangées au coucher du soleil sous un ciel bleu nuit')
    const rpc = aPage.waitForRequest((r: Request) => r.method() === 'POST' && r.url().includes('/_serverFn/'))
    await aPage.getByRole('button', { name: 'Valider et publier' }).click()
    const approveRequest = await rpc
    await expect(aPage.getByText('Photo publiée.')).toBeVisible()
    expect((await photoByTitle(titleA))!.status).toBe('approved')

    // Replay the exact approve call for photo B with the photographer's session → refused.
    const body = (approveRequest.postData() ?? '').replaceAll(a.id, b.id)
    const headers = { ...approveRequest.headers(), origin: baseURL! }
    delete (headers as Record<string, string>).cookie
    const replay = await pPage.request.post(approveRequest.url(), { headers, data: body })
    expect(replay.status()).toBeGreaterThanOrEqual(400)
    // …and anonymously.
    const anonReplay = await anon.request.post(approveRequest.url(), { headers, data: body })
    expect(anonReplay.status()).toBeGreaterThanOrEqual(400)
    // …and cross-site (CSRF) even with the admin's own session.
    const csrf = await aPage.request.post(approveRequest.url(), { headers: { ...headers, origin: 'https://evil.example' }, data: body })
    expect(csrf.status()).toBe(403)
    expect((await photoByTitle(titleB))!.status).toBe('pending')

    // Approved: public derivatives are served and contain no metadata.
    for (const f of ['thumb-480.webp', 'thumb-960.avif', 'preview-1600.webp', 'preview-1080.avif', 'og-1200.jpeg']) {
      const r = await anon.request.get(`/media/p/${a.id}/${a.public_token}/${f}`)
      expect(r.status(), f).toBe(200)
      const buf = await r.body()
      const tags = await exifr.parse(buf, { tiff: true, exif: true, gps: true, xmp: true, iptc: true, icc: false }).catch(() => undefined)
      expect(tags ?? null, `metadata in ${f}`).toBeNull()
      expect(await exifr.gps(buf).catch(() => undefined)).toBeUndefined()
    }
    // The private review copy and the original are still never public.
    expect((await anon.request.get(`/media/p/${a.id}/${a.public_token}/review-2048.webp`)).status()).toBe(404)
    expect((await anon.request.get(`/files/${a.original_key}`)).status()).toBe(403)
    // A wrong token never works.
    expect((await anon.request.get(`/media/p/${a.id}/aaaaaaaaaaaa/thumb-480.webp`)).status()).toBe(404)

    await Promise.all([photographer.close(), admin.close(), anon.close()])
  })

  test('if the AI check fails or is unavailable, the photo stays pending', async ({ page }) => {
    const stamp = Date.now()
    const email = uniqueEmail('ai')
    await signUpAndVerify(page, { name: 'Photographe IA', email, password: PASSWORD })
    const file = await makeTestJpeg(`ai-${stamp}`)

    await uploadPhoto(page, file, `Erreur IA [ai:error] ${stamp}`)
    const errored = await waitForProcessing(`Erreur IA [ai:error] ${stamp}`)
    expect(errored.ai_status).toBe('error')
    expect(errored.status).toBe('pending')

    const file2 = await makeTestJpeg(`ai2-${stamp}`, 2200, 1500)
    await uploadPhoto(page, file2, `IA indisponible [ai:unavailable] ${stamp}`)
    const unavailable = await waitForProcessing(`IA indisponible [ai:unavailable] ${stamp}`)
    expect(unavailable.ai_status).toBe('unavailable')
    expect(unavailable.status).toBe('pending')

    const file3 = await makeTestJpeg(`ai3-${stamp}`, 2300, 1500)
    await uploadPhoto(page, file3, `IA propre ${stamp}`)
    const clear = await waitForProcessing(`IA propre ${stamp}`)
    expect(clear.ai_status).toBe('clear')
    // "Nothing flagged" is never an approval.
    expect(clear.status).toBe('pending')
  })

  test('uploads are validated by content, not by extension', async ({ page }) => {
    const email = uniqueEmail('fake')
    await signUpAndVerify(page, { name: 'Photographe Faux', email, password: PASSWORD })
    await page.goto('/fr/dashboard/upload')
    const res = await page.request.post('/api/photos/upload', {
      headers: { origin: new URL(page.url()).origin },
      multipart: {
        file: { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('<?php echo "not an image"; ?>'.padEnd(200, ' ')) },
        title: 'Faux fichier',
        regionSlug: 'adrar',
        category: 'landscapes',
        authorName: 'Test',
        yearTaken: '2024',
        hasPeople: 'no',
        hasMinor: 'no',
        confirmRights: 'true',
        confirmConsent: 'true',
        confirmRules: 'true',
      },
    })
    expect(res.status()).toBe(415)
    expect((await res.json()).error).toBe('file_type')
  })
})
