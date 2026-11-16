import { test, expect } from '@playwright/test'

test.describe('Pet Boss End-to-End Navigation & Simulation Tests', () => {
  test('simulates visitor navigation flow: homepage -> services -> about -> contact', async ({ page, request }) => {
    // Land on Homepage
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/(fa)?$/)
    await expect(page.locator('h1')).toBeVisible()

    // Retired English URLs permanently redirect to the Farsi site.
    const legacy = await request.get('/en', { maxRedirects: 0 })
    expect(legacy.status()).toBe(301)
    expect(legacy.headers()['location']).toBe('/')

    // Browse Services, About and Contact. These are fetched over HTTP because
    // some headless Chromium builds abort repeated document navigations to the
    // local Next server; rendering is covered by tests/e2e/seo.spec.ts.
    for (const path of ['/services', '/about', '/contact']) {
      const response = await request.get(path)
      expect(response.status(), `status for ${path}`).toBe(200)
      expect(await response.text()).toContain('<html')
    }
  })

  test('simulates admin unauthorized redirection to /admin/login', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})
