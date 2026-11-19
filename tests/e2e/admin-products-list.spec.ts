import { test, expect } from '@playwright/test'
import crypto from 'crypto'

function generateAdminSessionCookie(baseURL: string) {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'petboss-super-secure-secret-key-2026-v1'
  const payload = {
    userId: 'admin_test_e2e',
    email: 'admin@petboss.com',
    name: 'Clinic Administrator',
    role: 'ADMIN',
    expiresAt: Math.floor(Date.now() / 1000) + 86400,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url')
  const token = `${encodedPayload}.${signature}`

  const url = new URL(baseURL || 'http://localhost:3000')
  return {
    name: 'petboss_session',
    value: token,
    domain: url.hostname,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  }
}


/** The products list is filtered and paged on the server: one page per visit, state in the URL. */
test.describe('admin products list', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([generateAdminSessionCookie(baseURL!)])
  })

  test('shows one page of products, pages and filters through the URL, and stays light', async ({ page }) => {
    const res = await page.goto('/admin/products', { waitUntil: 'domcontentloaded' })
    expect((await res!.body()).length).toBeLessThan(700 * 1024)
    const firstPageRows = await page.locator('tbody tr').count()
    expect(firstPageRows).toBeGreaterThan(0)
    expect(firstPageRows).toBeLessThanOrEqual(50)
    const firstName = await page.locator('tbody tr').first().locator('p.font-bold').first().innerText()

    // Per-page size comes from the URL
    await page.goto('/admin/products?size=25', { waitUntil: 'domcontentloaded' })
    expect(await page.locator('tbody tr').count()).toBeLessThanOrEqual(25)

    // A search narrows the list (server side) and an impossible one shows the empty state
    await page.goto('/admin/products?q=' + encodeURIComponent(firstName.slice(0, 6)), { waitUntil: 'domcontentloaded' })
    await expect(page.locator('tbody tr').first()).toContainText(firstName.slice(0, 6))
    await page.goto('/admin/products?q=zzzz-no-such-product-9999', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('هیچ محصولی با این مشخصات یافت نشد.')).toBeVisible()

    // Garbage parameters never break the page
    const bad = await page.goto('/admin/products?page=-5&size=abc&status=NOPE&cat=missing', { waitUntil: 'domcontentloaded' })
    expect(bad!.status()).toBe(200)
  })

  test('typing in the search box filters through the server', async ({ page }) => {
    await page.goto('/admin/products', { waitUntil: 'domcontentloaded' })
    const box = page.getByPlaceholder(/جستجوی نام/)
    await page.waitForFunction(() => Object.keys(document.querySelector('input[type="text"]') ?? {}).some((k) => k.startsWith('__reactProps')))
    await box.fill('zzzz-no-such-product-9999')
    await expect(page).toHaveURL(/q=zzzz-no-such-product-9999/)
    await expect(page.getByText('هیچ محصولی با این مشخصات یافت نشد.')).toBeVisible()
  })
})
