import { test, expect } from '@playwright/test'

test.describe('Indexable shop pages', () => {
  test('category page lists products that link to product pages with Product schema', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' })
    const categoryLink = page.locator('nav[aria-label="دسته‌بندی‌های پت‌شاپ"] a').first()
    await expect(categoryLink).toBeVisible()
    await categoryLink.click()
    await expect(page).toHaveURL(/\/shop\/[^/?]+/)
    await expect(page.locator('h1')).toContainText('خرید')

    const productLink = page.locator('article a[href^="/product/"]').first()
    await expect(productLink).toBeVisible()
    await productLink.click()
    await expect(page).toHaveURL(/\/product\//)
    await expect(page.locator('h1')).toBeVisible()

    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents()
    const product = schemas.map((s) => JSON.parse(s)).find((j) => j['@type'] === 'Product')
    expect(product).toBeTruthy()
    expect(product.offers.priceCurrency).toBe('IRR')

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical).toMatch(/^https:\/\/www\.petbossclinic\.com\/product\//)
  })

  test('sitemap includes product and category URLs', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.ok()).toBeTruthy()
    const xml = await res.text()
    expect(xml).toContain('/product/')
    expect(xml).toContain('/shop/')
    expect(xml).not.toContain('/en/')
  })

  test('unknown product returns 404', async ({ page }) => {
    const res = await page.goto('/product/this-product-does-not-exist-123')
    expect(res?.status()).toBe(404)
  })
})
