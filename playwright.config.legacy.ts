import { defineConfig, devices } from '@playwright/test';

/**
 * レガシーE2Eテストスイート（tests/legacy）専用 Playwright設定
 */
export default defineConfig({
  timeout: 60000,
  testDir: './tests/legacy',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
    ['html', { outputFolder: 'playwright-report-legacy', host: '0.0.0.0', port: 9325, open: 'never' }]
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: process.env.CI ? 'npm run build && npm run preview -- --port 5173 --host 127.0.0.1' : 'npm run dev',
    url: 'http://127.0.0.1:5173',
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
});
