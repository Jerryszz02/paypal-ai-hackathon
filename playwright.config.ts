import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3108',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: process.env.CI ? 'chromium' : 'chrome' },
    },
  ],
  webServer: {
    command:
      'CARRY_E2E=1 APP_MODE=demo LOCAL_DATA_DIR=.local/e2e next dev --hostname 127.0.0.1 --port 3108',
    url: 'http://127.0.0.1:3108/login',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { NEXT_TELEMETRY_DISABLED: '1' },
  },
});
