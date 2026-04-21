// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  // Flutter UI tests require a built Flutter web app — skip in CI
  testIgnore: process.env.CI ? ['**/flutter_ui.spec.js', '**/login_flow.spec.js'] : [],
  timeout: 120_000,
  retries: 0,
  workers: 1,       // run serially — Flutter dev server handles one connection reliably
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:8282',
    headless: true,
    actionTimeout: 90_000,
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'cross-env NODE_ENV=test node app.js',
      url: 'http://localhost:3000/health',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    // Flutter web server only needed for local UI testing — skipped in CI
    ...(process.env.CI ? [] : [{
      command: 'npx serve -p 8282 ../apps/mobile/build/web',
      url: 'http://localhost:8282',
      reuseExistingServer: true,
      timeout: 15_000,
    }]),
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Firefox and WebKit run locally only — Flutter web has no cross-browser CI build
    ...(process.env.CI ? [] : [
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit',  use: { ...devices['Desktop Safari']  } },
    ]),
  ],
});
