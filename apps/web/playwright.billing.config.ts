import { defineConfig } from '@playwright/test';
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
export default defineConfig({
  testDir: './e2e/billing',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  timeout: 90000,
  globalTimeout: 600000,
  expect: { timeout: 15000 },
  outputDir: '.e2e-results/billing/runtime',
  reporter: './e2e/billing/reporter.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL,
    ignoreHTTPSErrors: true,
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.BILLING_E2E_CHROME_EXECUTABLE || undefined,
    },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'desktop',
      testMatch: 'billing-desktop.spec.ts',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      testMatch: 'billing-mobile.spec.ts',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
