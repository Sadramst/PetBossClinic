import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-ltr',
      use: { ...devices['Desktop Chrome'], locale: 'en-US' },
    },
    {
      name: 'chromium-rtl',
      use: { ...devices['Desktop Chrome'], locale: 'fa-IR' },
    },
    {
      name: 'Mobile Chrome-ltr',
      use: { ...devices['Pixel 5'], locale: 'en-US' },
    },
    {
      name: 'Mobile Chrome-rtl',
      use: { ...devices['Pixel 5'], locale: 'fa-IR' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
