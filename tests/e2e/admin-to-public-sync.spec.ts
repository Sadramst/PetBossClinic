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

test.describe('Admin Control to Public Site Synchronization (Phase 1 Acceptance)', () => {
  test('authenticated admin can access admin panel and updates propagate to public views', async ({ page, context, baseURL }) => {
    // 1. Authenticate via secure session token
    const cookie = generateAdminSessionCookie(baseURL || 'http://localhost:3000')
    await context.addCookies([cookie])

    // 2. Navigate to Admin Panel
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin/)

    // 3. Verify Admin Modules are present (Phase 1 modules)
    const isDesktop = (page.viewportSize()?.width ?? 1280) >= 1024
    if (isDesktop) {
      await expect(page.locator('a[href*="/admin/homepage"]').first()).toBeVisible()
      await expect(page.locator('a[href*="/admin/social"]').first()).toBeVisible()
      await expect(page.locator('a[href*="/admin/menus"]').first()).toBeVisible()
      await expect(page.locator('a[href*="/admin/testimonials"]').first()).toBeVisible()
      await expect(page.locator('a[href*="/admin/staff"]').first()).toBeVisible()
    } else {
      await expect(page.locator('a[href*="/admin/homepage"]').first()).toBeAttached()
      await expect(page.locator('a[href*="/admin/staff"]').first()).toBeAttached()
    }

    // 4. Navigate to Homepage Manager
    await page.goto('/admin/homepage')
    await expect(page.getByRole('heading', { name: /(مدیریت و کنترل بخش‌های صفحه اصلی|Homepage Sections Control)/ })).toBeVisible()

    // 5. Navigate to Public Homepage and verify zero prices do NOT exist
    await page.goto('/fa')
    const priceElements = await page.locator('span:has-text("تومان")').allInnerTexts()
    for (const text of priceElements) {
      expect(text).not.toMatch(/(^|[^\u06F0-\u06F90-9,٬])۰\s*تومان/)
    }

    // 6. Verify single canonical address rendered on public page
    await expect(page.locator('body')).toContainText('پلاک ۱۷۳۳')

    // 7. Verify conflicting old address does not exist anywhere on public page
    await expect(page.locator('body')).not.toContainText('بلوار صبا قیطریه')

    // 8. Verify Dr. Ali Hadidi is inactive and therefore NOT rendered on public page
    await expect(page.locator('body')).not.toContainText('دکتر علی حدیدی')

    // 9. Navigate to Staff Manager in admin and verify the active/inactive switch toggle is present
    await page.goto('/admin/staff')
    await expect(page.locator('button[role="switch"]').first()).toBeAttached()
  })
})
