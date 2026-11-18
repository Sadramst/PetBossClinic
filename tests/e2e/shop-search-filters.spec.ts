import { test, expect } from '@playwright/test'

test.describe('Shop search, filters and listings', () => {
  test('header search targets the shop and renders noindex results', async ({ page, isMobile }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const box = page.locator(isMobile ? '#site-search-mobile' : '#site-search')
    await box.fill('رویال کنین')

    // The header is a plain GET form, so search works before hydration.
    const form = page.locator('form[role="search"]').first()
    await expect(form).toHaveAttribute('action', '/shop')
    await expect(form).toHaveAttribute('method', 'get')
    await expect(box).toHaveAttribute('name', 'q')

    // Some headless Chromium builds abort full-document navigations to a local
    // Next server, so verify the exact URL the form produces at the HTTP level.
    const res = await page.request.get('/shop?q=' + encodeURIComponent('رویال کنین'))
    expect(res.ok()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain('نتایج جستجو برای')
    expect(html).toContain('رویال کنین')
    // Search result pages must not be indexed
    expect(html).toMatch(/name="robots"\s+content="noindex/)
  })

  test('filters are plain URLs: pet + sort + stock', async ({ page }) => {
    await page.goto('/shop?pet=cat&sort=price-asc&stock=1', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('a:has-text("گربه ✕")').first()).toBeVisible()
    await expect(page.locator('select').first()).toHaveValue('price-asc')
    await expect(page.locator('article').first()).toBeVisible()

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
    const select = page.locator('select').first()
    // The select is only interactive after hydration; React marks hydrated nodes
    // with a __reactProps key (dev builds can take >1s to hydrate).
    await page.waitForFunction(() => {
      const el = document.querySelector('select')
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps'))
    })
    await select.selectOption('newest')
    await expect(page).toHaveURL(/sort=newest/, { timeout: 15000 })
    expect(page.url()).not.toContain('page=2')
  })

  test('pagination links are crawlable and self-canonical', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' })
    const next = page.locator('a[rel="next"]')
    await expect(next).toHaveAttribute('href', /page=2/)
    await next.click()
    await expect(page).toHaveURL(/page=2/)
    // During client-side navigation Next briefly keeps the previous page's head tags next to the new
    // ones; the newest canonical is the one that must point at page 2.
    await expect(page.locator('link[rel="canonical"]').last()).toHaveAttribute('href', 'https://www.petbossclinic.com/shop?page=2', { timeout: 15000 })
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
