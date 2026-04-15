const { test, expect } = require('@playwright/test');

// Browser-only smoke test — skipped unless Playwright browsers are installed.
// Run `npx playwright install chromium` then re-enable this test.
test.skip('homepage loads (requires browser install)', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page).toHaveTitle(/Jyotish/);
});
