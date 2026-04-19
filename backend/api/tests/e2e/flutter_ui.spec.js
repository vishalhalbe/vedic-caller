// @ts-check
const { test, expect } = require('@playwright/test');

// Flutter web serves from root; GoRouter handles hash routing client-side.
// Always navigate to root and let Flutter redirect to /#/login.
// Release build served by: npx serve -p 8282 apps/mobile/build/web
const BASE = 'http://localhost:8282';

async function waitForFlutter(page) {
  // Don't wait for networkidle — Flutter's service worker keeps connections open.
  // Wait for the flutter-view element which appears once the Dart runtime boots.
  await page.waitForSelector('flutter-view', { timeout: 90_000 });
  await page.waitForTimeout(2000);
}

// ── Auth Screen ───────────────────────────────────────────────────────────────

test('app title is JyotishConnect', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  await expect(page).toHaveTitle('JyotishConnect');
});

test('Flutter view renders and is visible', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  await expect(page.locator('flutter-view')).toBeVisible();
  await page.screenshot({ path: 'test-results/01-app-loaded.png' });
});

test('no fatal JS errors on load', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE);
  await waitForFlutter(page);
  const fatal = errors.filter(
    e => !e.includes('ResizeObserver') && !e.includes('non-passive')
  );
  expect(fatal).toHaveLength(0);
});

test('Flutter semantics placeholder is present', async ({ page }) => {
  await page.goto(BASE);
  await page.waitForSelector('flt-semantics-placeholder', { timeout: 30_000 });
  const el = page.locator('flt-semantics-placeholder');
  await expect(el).toBeAttached();
});

// ── Responsive Viewports ─────────────────────────────────────────────────────

test('renders at mobile viewport (375x812)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE);
  await waitForFlutter(page);
  await expect(page.locator('flutter-view')).toBeVisible();
  await page.screenshot({ path: 'test-results/viewport-mobile-375.png' });
});

test('renders at tablet viewport (768x1024)', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(BASE);
  await waitForFlutter(page);
  await expect(page.locator('flutter-view')).toBeVisible();
  await page.screenshot({ path: 'test-results/viewport-tablet-768.png' });
});

test('renders at desktop viewport (1280x800)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE);
  await waitForFlutter(page);
  await expect(page.locator('flutter-view')).toBeVisible();
  await page.screenshot({ path: 'test-results/viewport-desktop-1280.png' });
});

// ── Performance ───────────────────────────────────────────────────────────────

test('flutter-view appears within 40 seconds', async ({ page }) => {
  const start = Date.now();
  await page.goto(BASE);
  await page.waitForSelector('flutter-view', { timeout: 40_000 });
  const elapsed = Date.now() - start;
  console.log(`  Flutter boot time: ${elapsed}ms`);
  expect(elapsed).toBeLessThan(40_000);
});
