// @ts-check
/**
 * Visual & UI smoke tests — catch rendering failures, broken icons,
 * broken payment SDK injection, and platform-specific Flutter web issues.
 *
 * These tests require Flutter web to be running on localhost:8282.
 * They are skipped in CI (flutter_ui listed in playwright.config.js testIgnore).
 *
 * Run locally:
 *   node app.js &
 *   flutter run -d chrome --web-port 8282 &
 *   npx playwright test tests/e2e/visual_ui.spec.js --reporter=list
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8282';
const API  = 'http://localhost:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForFlutter(page) {
  await page.waitForSelector('flutter-view', { timeout: 90_000 });
  await page.waitForTimeout(3000);
}

async function enableSemantics(page) {
  await page.locator('flt-semantics-placeholder').dispatchEvent('click');
  await page.waitForTimeout(2000);
}

async function tapByText(page, text) {
  const node = page.locator('flt-semantics[flt-tappable]').filter({ hasText: text }).first();
  await node.waitFor({ timeout: 10_000 });
  await node.dispatchEvent('click');
  await page.waitForTimeout(800);
}

async function screenshot(page, name) {
  await page.screenshot({ path: `test-results/visual-${name}.png`, fullPage: true });
}

async function registerAndLogin(request) {
  const email = `vis_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: 'Visual Tester' },
  });
  const body = await reg.json();
  return { ...body, email };
}

// ── 1 · Icon Font Rendering ───────────────────────────────────────────────────
// Catches: missing uses-material-design, icon font not loaded on web

test('VIS-01 · no broken icon placeholder boxes (□) on login screen', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  await screenshot(page, '01-login-before-semantics');

  // Detect placeholder boxes: Flutter renders unloaded icons as Unicode □ (U+25A1)
  // or as empty flt-canvas elements with 0-size content — check via page content
  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText).not.toContain('\u25A1'); // □

  // Verify Material Icons stylesheet loaded (injected in index.html)
  const materialIconsLoaded = await page.evaluate(() => {
    return Array.from(document.styleSheets).some(
      (s) => s.href && s.href.includes('Material+Icons'),
    );
  });
  expect(materialIconsLoaded).toBe(true);

  await screenshot(page, '01-login-icons-ok');
});

test('VIS-02 · no JS errors on initial load', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await waitForFlutter(page);

  const fatal = errors.filter(
    (e) =>
      !e.includes('ResizeObserver') &&
      !e.includes('non-passive') &&
      !e.includes('favicon'),
  );
  expect(fatal, `Fatal JS errors: ${fatal.join('\n')}`).toHaveLength(0);
});

// ── 2 · Razorpay SDK Injection ────────────────────────────────────────────────
// Catches: missing <script src="checkout.razorpay.com/v1/checkout.js"> in index.html

test('VIS-03 · Razorpay checkout.js is loaded on the page', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);

  const razorpayLoaded = await page.evaluate(() => typeof window.Razorpay !== 'undefined');
  expect(razorpayLoaded, 'window.Razorpay not found — checkout.js not injected in index.html').toBe(true);
});

test('VIS-04 · Add Funds button opens Razorpay checkout modal', async ({ page, request }) => {
  // Seed a user with 0 balance via API, then inject token into Flutter storage
  const user = await registerAndLogin(request);

  // Intercept Razorpay checkout iframe appearing
  const checkoutPromise = page.waitForEvent('popup', { timeout: 15_000 }).catch(() => null);
  const framePromise = page.waitForFrame(
    (f) => f.url().includes('razorpay.com'),
    { timeout: 15_000 },
  ).catch(() => null);

  // Navigate to wallet page directly
  await page.goto(`${BASE}/#/wallet`);
  await waitForFlutter(page);
  await enableSemantics(page);

  // Tap ₹100 chip to select amount
  await tapByText(page, '₹100');

  // Tap Add button
  await tapByText(page, 'Add ₹100');
  await page.waitForTimeout(3000);

  // Either a popup or an iframe from Razorpay should appear
  const popup = await checkoutPromise;
  const frame = await framePromise;

  const razorpayOpened = popup !== null || frame !== null;
  expect(
    razorpayOpened,
    'Razorpay checkout did not open — window.Razorpay.open() may have failed silently',
  ).toBe(true);

  await screenshot(page, '04-razorpay-checkout-opened');
});

// ── 3 · Visual Regression Snapshots ──────────────────────────────────────────
// Catches: layout breaks, colour regressions, missing widgets after code changes

test('VIS-05 · login screen snapshot', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  await screenshot(page, '05-login-screen');
  await expect(page).toHaveScreenshot('login-screen.png', {
    maxDiffPixels: 500,
    threshold: 0.05,
  });
});

test('VIS-06 · home screen snapshot after login', async ({ page, request }) => {
  const user = await registerAndLogin(request);

  // Set token in localStorage so Flutter picks it up on next load
  await page.goto(BASE);
  await waitForFlutter(page);
  await page.evaluate(
    ([token, userId]) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_id', userId);
    },
    [user.token, user.user_id],
  );
  await page.reload();
  await waitForFlutter(page);
  await page.waitForTimeout(2000);

  await screenshot(page, '06-home-screen');
  await expect(page).toHaveScreenshot('home-screen.png', {
    maxDiffPixels: 500,
    threshold: 0.05,
  });
});

// ── 4 · Responsive Layout ─────────────────────────────────────────────────────

const VIEWPORTS = [
  { name: 'mobile-375',  width: 375,  height: 812  },
  { name: 'tablet-768',  width: 768,  height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
];

for (const vp of VIEWPORTS) {
  test(`VIS-07 · responsive — no overflow at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(BASE);
    await waitForFlutter(page);

    // Check no horizontal scroll (content overflow)
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow, `Horizontal overflow at ${vp.name}`).toBe(false);

    await screenshot(page, `07-responsive-${vp.name}`);
  });
}

// ── 5 · UI State Tests ────────────────────────────────────────────────────────
// Catches: disabled states not shown, call button enabled when it shouldn't be

test('VIS-08 · Call Now button is disabled when wallet balance is 0', async ({ page, request }) => {
  const user = await registerAndLogin(request);

  await page.goto(BASE);
  await waitForFlutter(page);
  await enableSemantics(page);

  // The "Add at least ₹10" message should be visible, not a tappable Call Now
  const callNowTappable = await page
    .locator('flt-semantics[flt-tappable]')
    .filter({ hasText: /Call Now/i })
    .count();
  expect(callNowTappable, 'Call Now should not be tappable with 0 balance').toBe(0);

  // Disabled message should be visible
  const disabledMsg = page.locator('flt-semantics').filter({ hasText: /Add at least/i });
  await expect(disabledMsg).toBeAttached();

  await screenshot(page, '08-call-disabled-zero-balance');
});

test('VIS-09 · wallet balance displays ₹0.00 for new user', async ({ page, request }) => {
  const user = await registerAndLogin(request);

  await page.goto(`${BASE}/#/wallet`);
  await waitForFlutter(page);
  await enableSemantics(page);

  const balanceText = page.locator('flt-semantics').filter({ hasText: /₹0\.00/ });
  await expect(balanceText).toBeAttached();

  await screenshot(page, '09-wallet-zero-balance');
});

test('VIS-10 · astrologer profile shows rate and availability badge', async ({ page, request }) => {
  // Create an available astrologer
  const email = `vis_astro_${Date.now()}@test.com`;
  const astroRes = await request.post(`${API}/astrologer/auth/register`, {
    data: { name: 'Vis Astro', email, password: 'password123', rate_per_minute: 15 },
  });
  const astro = await astroRes.json();
  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });

  await page.goto(`${BASE}/#/astrologer/${astro.astrologer_id}`);
  await waitForFlutter(page);
  await enableSemantics(page);

  // Rate badge
  const rateBadge = page.locator('flt-semantics').filter({ hasText: /₹15\/min/ });
  await expect(rateBadge).toBeAttached();

  // Available badge
  const availBadge = page.locator('flt-semantics').filter({ hasText: /Available/i });
  await expect(availBadge).toBeAttached();

  await screenshot(page, '10-astrologer-profile-badges');
});

// ── 6 · Critical Flow — Full Wallet Top-up Journey ───────────────────────────
// Catches: payment button silently failing end-to-end

test('VIS-11 · wallet top-up flow — order created on backend before checkout opens', async ({ request }) => {
  const user = await registerAndLogin(request);

  // Verify the /wallet/create-order endpoint works (what Add Funds button calls first)
  const order = await request.post(`${API}/wallet/create-order`, {
    headers: { Authorization: `Bearer ${user.token}` },
    data: { amount: 100 },
  });
  expect(order.status(), 'create-order must return 200 before Razorpay opens').toBe(200);
  const body = await order.json();
  expect(body.order_id, 'order_id must be present for Razorpay to open').toBeTruthy();
  expect(body.amount).toBe(10000); // paise
});
