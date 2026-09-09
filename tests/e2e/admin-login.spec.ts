import { test, expect } from '@playwright/test';

test.describe('Admin Authentication & Protection Flow', () => {
  test('redirects unauthenticated visitor from /admin to /admin/login', async ({ page }) => {
    // Navigate directly to protected admin URL
    await page.goto('/admin');

    // Must be redirected to the real admin login URL, NOT 404 and NOT auth/login
    await expect(page).toHaveURL(/\/admin\/login/);

    // Verify login form is present
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('redirects unauthenticated visitor from /en/admin to /en/admin/login', async ({ page }) => {
    await page.goto('/en/admin');
    await expect(page).toHaveURL(/\/en\/admin\/login/);
  });

  test('rejects forged session cookie without valid signature', async ({ page, context }) => {
    // Attempt PII leak exploit: forge a cookie
    await context.addCookies([
      {
        name: 'petboss_session',
        value: 'forged_unauthorized_token_without_valid_hmac_signature',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Try accessing protected leads route
    await page.goto('/admin/leads');

    // Must redirect to login, denying access to leads PII
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
