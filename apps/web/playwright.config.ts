import { defineConfig } from '@playwright/test';

// Playwright 1.64 also writes automatic ARIA error snapshots with trace off.
// Verified against the pinned runner; a negative browser control checks privacy.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: true,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  globalTimeout: 300_000,
  expect: { timeout: 10_000 },
  outputDir: '.e2e-results/runtime',
  reporter: './e2e/safe-reporter.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://127.0.0.1:3443',
    browserName: 'chromium',
    ignoreHTTPSErrors: true, // Ephemeral, local self-signed certificate only.
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop',
      testMatch: '**/critical.spec.ts',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      testMatch: '**/mobile.spec.ts',
      use: {
        viewport: { width: 320, height: 700 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
