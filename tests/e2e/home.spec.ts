import { test, expect } from '@playwright/test'

test.describe('Pet Boss End-to-End Navigation & Simulation Tests', () => {
  test('simulates visitor navigation flow: homepage -> services -> about -> contact', async ({ page }) => {
    // Land on Homepage
    await page.goto('/')
    await expect(page).toHaveURL(/\/(fa)?$/)

    // Switch language or browse English
    await page.goto('/en')
    await expect(page).toHaveURL(/\/en$/)

    // Browse Services
    await page.goto('/services')
    await expect(page).toHaveURL(/\/services$/)

    // Visit About Us
    await page.goto('/about')
    await expect(page).toHaveURL(/\/about$/)

    // Visit Contact
    await page.goto('/contact')
    await expect(page).toHaveURL(/\/contact$/)
  })

  test('simulates admin unauthorized redirection to /admin/login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})

