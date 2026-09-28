import { defineConfig, devices } from '@playwright/test';

/**
 * ペルソナ別E2Eプレイスルー・シミュレーション専用 Playwright設定
 */
export default defineConfig({
  timeout: 120000, // フルプレイスルーのため120秒に設定
  testDir: './tests/personas',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // 直列で確実に実行
  reporter: [
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
    ['html', { outputFolder: 'playwright-report-personas', host: '0.0.0.0', port: 9324, open: 'never' }]
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
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
