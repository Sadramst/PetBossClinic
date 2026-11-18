import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a real server and the real database.
 *   CI            : `next start` on port 3000 (the workflow builds first).
 *   local         : `npm run test:all` sets E2E_PROD=1 and E2E_PORT=3200 (port 3000 is often busy);
 *                   or `npx playwright test` to use `next dev`.
 * The site is Farsi-only, so both projects use the fa-IR locale: one desktop, one phone.
 */
const PORT = Number(process.env.E2E_PORT || 3000);
const BASE_URL = `http://localhost:${PORT}`;
const production = !!process.env.CI || !!process.env.E2E_PROD;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One server and one database serve every worker; more than two makes timing-sensitive tests flaky.
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: BASE_URL,
    navigationTimeout: 45000,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-rtl',
      use: { ...devices['Desktop Chrome'], locale: 'fa-IR' },
    },
    {
      name: 'Mobile Chrome-rtl',
      use: { ...devices['Pixel 5'], locale: 'fa-IR' },
    },
  ],
  webServer: {
    command: production ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
