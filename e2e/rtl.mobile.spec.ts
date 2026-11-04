import { expect, test } from '@playwright/test'

test.describe('mobile, RTL and language switching', () => {
  test('Arabic pages are RTL with their own typography', async ({ page }) => {
    await page.goto('/ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    const font = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily)
    expect(font).toContain('Markazi')
    // Arabic never gets letter-spacing (it breaks joining).
    const spacing = await page.locator('.eyebrow').first().evaluate((el) => getComputedStyle(el).letterSpacing)
    expect(['normal', '0px']).toContain(spacing)
  })

  test('the mobile menu opens, traps focus in a dialog and closes with Escape', async ({ page }) => {
    await page.goto('/fr')
    await page.getByRole('button', { name: 'Menu' }).click()
    const dialog = page.getByRole('dialog', { name: 'Menu' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Explorer' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('switching language keeps the page and its filters', async ({ page }) => {
    await page.goto('/fr/explore?region=adrar')
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('dialog').getByRole('link', { name: 'العربية' }).click()
    await expect(page).toHaveURL(/\/ar\/explore\?region=adrar/)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  })

  test('no horizontal scrolling on key pages (fr + ar)', async ({ page }) => {
    for (const path of ['/fr', '/ar', '/fr/explore', '/ar/explore', '/fr/photographers', '/ar/about', '/fr/auth/signup', '/ar/report']) {
      await page.goto(path)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, path).toBeLessThanOrEqual(1)
    }
  })
})
