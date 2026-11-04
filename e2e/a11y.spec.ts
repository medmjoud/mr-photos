import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ADMIN, approveAsAdmin, login, makeTestJpeg, signUpAndVerify, uniqueEmail, uploadPhoto, waitForProcessing } from './helpers'

/** WCAG 2.2 AA automated checks (axe-core) on key pages, both themes, fr + ar. */
async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(' ')}`)
  expect(summary, `${label}\n${summary.join('\n')}`).toEqual([])
}

async function scroll(page: Page) {
  // Trigger reveal-on-scroll so content is fully visible before auditing.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 40))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(800)
}

test('key pages have no WCAG 2.2 AA violations (axe)', async ({ browser }) => {
  test.setTimeout(360_000)
  // Content to audit: one approved photo.
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const stamp = Date.now()
  await signUpAndVerify(page, { name: `Accessible ${stamp}`, email: uniqueEmail('a11y'), password: 'mot de passe accessible' })
  await uploadPhoto(page, await makeTestJpeg(`a11y-${stamp}`), `Accessibilité ${stamp}`)
  const photo = await waitForProcessing(`Accessibilité ${stamp}`)
  const admin = await browser.newContext()
  const aPage = await admin.newPage()
  await login(aPage, ADMIN.email, ADMIN.password)
  await approveAsAdmin(aPage, photo.id)

  const publicPaths = ['', '/explore', `/photos/x-${photo.id}`, '/photographers', '/about', '/content-rules', '/report', '/auth/login', '/auth/signup', '/nope-404']
  for (const theme of ['dark', 'light'] as const) {
    const visitor = await browser.newContext()
    await visitor.addInitScript((t) => {
      try {
        localStorage.setItem('soura-theme', t)
      } catch {
        /* ignore */
      }
    }, theme)
    const v = await visitor.newPage()
    for (const locale of ['fr', 'ar']) {
      for (const path of publicPaths) {
        await v.goto(`/${locale}${path}`)
        await scroll(v)
        await audit(v, `${theme} /${locale}${path}`)
      }
    }
    await visitor.close()
  }

  for (const path of ['/fr/dashboard', '/fr/dashboard/upload', '/fr/dashboard/profile']) {
    await page.goto(path)
    await audit(page, path)
  }
  for (const path of ['/fr/admin', '/fr/admin/review', `/fr/admin/review/${photo.id}`, '/fr/admin/users', '/fr/admin/reports']) {
    await aPage.goto(path)
    await audit(aPage, path)
  }
  await Promise.all([ctx.close(), admin.close()])
})

test('keyboard: skip link and visible focus', async ({ page }) => {
  await page.goto('/fr')
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Aller au contenu' })
  await expect(skip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main')).toBeFocused()
  // Focus ring is visible on interactive elements.
  await page.keyboard.press('Tab')
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)
  expect(outline).not.toBe('none')
})
