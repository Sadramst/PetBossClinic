import { test, expect } from '@playwright/test'

test.describe('Pet Boss End-to-End Navigation & Simulation Tests', () => {
  test('simulates visitor navigation flow: homepage -> services -> about -> contact', async ({ page }) => {
    // Land on Homepage
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/(fa)?$/)

    // Retired English URLs permanently redirect to the Farsi site
    await page.goto('/en', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/$/)

    // Browse Services
    await page.goto('/services', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/services$/)

    // Visit About Us
    await page.goto('/about', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/about$/)

    // Visit Contact
    await page.goto('/contact', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/contact$/)
  })

  test('simulates admin unauthorized redirection to /admin/login', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})

