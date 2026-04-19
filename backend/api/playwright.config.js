// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  retries: 0,
  workers: 1,       // run serially — Flutter dev server handles one connection reliably
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:8282',
    headless: true,
    actionTimeout: 90_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'cross-env NODE_ENV=test node app.js',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npx serve -p 8282 ../apps/mobile/build/web',
      url: 'http://localhost:8282',
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
