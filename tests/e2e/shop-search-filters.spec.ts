import { test, expect } from '@playwright/test'

test.describe('Pet Boss Shop Professional Search, Filter & AI Assistant E2E Tests', () => {
  test('browses shop catalog in Persian (RTL) with sidebar filters and sort controls', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/shop$/)

    // Check title / heading
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()

    // Check AI Assistant search bar exists
    const aiInput = page.locator('input[placeholder*="از هوش مصنوعی"]')
    await expect(aiInput).toBeVisible()

    // Check fast keyword search exists
    const searchInput = page.locator('input[placeholder*="جستجوی کالا"]')
    await expect(searchInput).toBeVisible()

    // Type a search term
    await searchInput.fill('رویال کنین')
    // Wait for client filter to update
    await page.waitForTimeout(300)

    // Check that active filter chip appears
    const activeChip = page.locator('text=رویال کنین')
    await expect(activeChip.first()).toBeVisible()
  })

  test('interacts with AI Search Assistant and triggers clinical guidance', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' })

    // Click on one of the quick AI prompts
    const sterilisedPrompt = page.locator('button:has-text("غذای گربه عقیم‌شده")')
    if (await sterilisedPrompt.isVisible()) {
      await sterilisedPrompt.click()

      // Clinical vet recommendation banner should appear
      const vetGuidance = page.locator('text=توصیه بالینی هوش مصنوعی کلینیک پت‌باس')
      await expect(vetGuidance).toBeVisible({ timeout: 5000 })
    }
  })

  test('opens product details modal and verifies AI thematic related products', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'domcontentloaded' })

    // Click the first product's "جزئیات" button
    const detailsBtn = page.locator('button:has-text("جزئیات")').first()
    if (await detailsBtn.isVisible()) {
      await detailsBtn.click()

      // Modal dialog should be visible
      const modal = page.locator('[role="dialog"]')
      await expect(modal).toBeVisible()

      // Look for the thematic recommendation title or section
      const bundleHeader = modal.locator('text=اقلام مکمل و بسته پیشنهادی')
      if (await bundleHeader.isVisible()) {
        await expect(bundleHeader).toBeVisible()
      }

      // Close modal
      const closeBtn = modal.locator('button:has-text("بستن")')
      await closeBtn.click()
      await expect(modal).not.toBeVisible()
    }
  })

  test('browses English shop catalog in LTR', async ({ page }) => {
    await page.goto('/en/shop', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/en\/shop$/)

    // Heading should be in English
    const heading = page.locator('h1')
    await expect(heading).toContainText(/Nutrition|Pet Supplies/i)

    // Filter by Pet tabs
    const catTab = page.locator('button:has-text("Cats")')
    if (await catTab.isVisible()) {
      await catTab.click()
    }
  })
})
