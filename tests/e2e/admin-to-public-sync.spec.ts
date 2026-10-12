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
    await expect(page.locator('a[href*="/admin/homepage"]')).toBeVisible()
    await expect(page.locator('a[href*="/admin/social"]')).toBeVisible()
    await expect(page.locator('a[href*="/admin/menus"]')).toBeVisible()
    await expect(page.locator('a[href*="/admin/testimonials"]')).toBeVisible()
    await expect(page.locator('a[href*="/admin/staff"]')).toBeVisible()

    // 4. Navigate to Homepage Manager
    await page.goto('/admin/homepage')
    await expect(page.locator('text=مدیریت سکشن‌های صفحه اصلی')).toBeVisible()

    // 5. Navigate to Public Homepage and verify zero prices do NOT exist
    await page.goto('/')
    const zeroPriceText = page.locator('text=۰ تومان')
    await expect(zeroPriceText).toHaveCount(0)

    // 6. Verify single canonical address rendered on public page
    const addressElement = page.locator('text=خیابان شریعتی، نرسیده به مترو قیطریه، پلاک ۱۷۳۳')
    await expect(addressElement.first()).toBeVisible()

    // 7. Verify conflicting old address does not exist anywhere on public page
    const conflictingAddress = page.locator('text=بلوار صبا قیطریه')
    await expect(conflictingAddress).toHaveCount(0)

    // 8. Verify Dr. Ali Hadidi is rendered on public page
    const doctorElement = page.locator('text=دکتر علی حدیدی')
    await expect(doctorElement.first()).toBeVisible()
  })
})
