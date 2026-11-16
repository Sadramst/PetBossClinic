import { test, expect } from '@playwright/test'

test.describe('Shop search, filters and listings', () => {
  test('header search finds products by Persian brand name', async ({ page, isMobile }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const box = page.locator(isMobile ? '#site-search-mobile' : '#site-search')
    await box.fill('رویال کنین')
    await box.press('Enter')
    await expect(page).toHaveURL(/\/shop\?q=/)
    await expect(page.locator('h1')).toContainText('رویال کنین')
    await expect(page.locator('article').first()).toBeVisible()
    // Search result pages must not be indexed
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
  })

  test('filters are plain URLs: pet + sort + stock', async ({ page }) => {
    await page.goto('/shop?pet=cat&sort=price-asc&stock=1', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('a:has-text("گربه ✕")').first()).toBeVisible()
    await expect(page.locator('select').first()).toHaveValue('price-asc')

    // Prices on the first page are ascending (cards show "N تومان")
    const prices = await page.locator('article .text-gradient-gold').allInnerTexts()
    const nums = prices
      .map((t) => Number(t.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[^\d]/g, '')))
      .filter((n) => n > 0)
    expect(nums.length).toBeGreaterThan(1)
    expect([...nums].sort((a, b) => a - b)).toEqual(nums)
  })

  test('changing sort navigates and resets to page 1', async ({ page }) => {
    await page.goto('/shop?page=2', { waitUntil: 'domcontentloaded' })
    await page.locator('select').first().selectOption('newest')
    await expect(page).toHaveURL(/sort=newest/)
    expect(page.url()).not.toContain('page=2')
  })

  test('pagination links are crawlable and self-canonical', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' })
    const next = page.locator('a[rel="next"]')
    await expect(next).toHaveAttribute('href', /page=2/)
    await next.click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.petbossclinic.com/shop?page=2')
  })

  test('brand page lists only that brand', async ({ page }) => {
    await page.goto('/brand/royal-canin', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toContainText('رویال کنین')
    const names = await page.locator('article h3').allInnerTexts()
    expect(names.length).toBeGreaterThan(0)
    for (const n of names) expect(n.toLowerCase()).toContain('royal')
  })

  test('legacy English shop URL redirects to the Farsi shop', async ({ page }) => {
    await page.goto('/en/shop', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/shop$/)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  })
})
