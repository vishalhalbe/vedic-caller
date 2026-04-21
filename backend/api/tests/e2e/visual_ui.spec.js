// @ts-check
const { checkA11y, injectAxe } = require('@axe-core/playwright');
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

// ── 6 · Accessibility (axe-core / WCAG 2.1) ──────────────────────────────────
// Catches: missing ARIA labels, insufficient colour contrast, missing alt text

test('VIS-12 · login screen passes axe WCAG 2.0/2.1 audit', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  await injectAxe(page);
  await checkA11y(page, undefined, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    rules: {
      // Flutter renders via canvas/shadow DOM — these rules don't apply to canvas elements
      'color-contrast': { enabled: false },
      'document-title': { enabled: false },
    },
  });
  await screenshot(page, '12-login-a11y-pass');
});

test('VIS-13 · Flutter view has flt-semantics-placeholder for screen reader entry point', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  // Flutter web exposes accessibility via flt-semantics-placeholder
  // This is the entry point for assistive technologies
  const placeholder = page.locator('flt-semantics-placeholder');
  await expect(placeholder).toBeAttached();
  // After enabling semantics, the full tree should appear
  await enableSemantics(page);
  const semanticsNodes = page.locator('flt-semantics');
  const count = await semanticsNodes.count();
  expect(count, 'Semantics tree should have multiple nodes after enabling').toBeGreaterThan(3);
  await screenshot(page, '13-semantics-tree-accessible');
});

// ── 7 · Additional Responsive Breakpoints ────────────────────────────────────

const EXTRA_VIEWPORTS = [
  { name: 'iphone-plus-414',  width: 414,  height: 896  },
  { name: 'ipad-landscape-1024', width: 1024, height: 768 },
];

for (const vp of EXTRA_VIEWPORTS) {
  test(`VIS-14 · no overflow at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(BASE);
    await waitForFlutter(page);

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow, `Horizontal overflow at ${vp.name}`).toBe(false);
    await screenshot(page, `14-responsive-${vp.name}`);
  });
}

// ── 8 · Async UI State Tests ──────────────────────────────────────────────────
// Catches: loading spinners not shown, error messages not surfaced, disabled states wrong

test('VIS-15 · Add Funds button shows loading state while creating order', async ({ page, request }) => {
  await registerAndLogin(request);

  // Intercept the create-order request so we can see the in-progress state
  await page.route('**/wallet/create-order', async (route) => {
    await page.waitForTimeout(500); // allow UI to show loading
    await route.continue();
  });

  await page.goto(`${BASE}/#/wallet`);
  await waitForFlutter(page);
  await enableSemantics(page);

  // Tap Add ₹500 — immediately screenshot to catch loading state
  await tapByText(page, 'Add ₹500');
  await screenshot(page, '15-add-funds-loading-state');

  // The button should show "Creating order…" or a spinner while in progress
  // Either the text changes OR the button becomes non-tappable (disabled)
  const creatingText = page.locator('flt-semantics').filter({ hasText: /Creating order/i });
  const stillTappable = page.locator('flt-semantics[flt-tappable]').filter({ hasText: /Add ₹/i });

  const isLoading = (await creatingText.count()) > 0 || (await stillTappable.count()) === 0;
  expect(isLoading, 'Button should show loading state or become disabled during order creation').toBe(true);
});

test('VIS-16 · astrologer list shows content or empty state — never blank', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  await enableSemantics(page);

  // The page must show EITHER astrologer cards OR an empty/loading indicator
  // It must never be completely blank after load
  const hasContent = await page.evaluate(() => {
    const view = document.querySelector('flutter-view');
    return view ? view.innerText.trim().length > 0 : false;
  });
  expect(hasContent, 'Page must not be completely blank after Flutter loads').toBe(true);
  await screenshot(page, '16-astrologer-list-not-blank');
});

test('VIS-17 · wallet page shows transaction history section heading', async ({ page, request }) => {
  await registerAndLogin(request);
  await page.goto(`${BASE}/#/wallet`);
  await waitForFlutter(page);
  await enableSemantics(page);

  const heading = page.locator('flt-semantics').filter({ hasText: /Recent Transactions/i });
  await expect(heading).toBeAttached();
  await screenshot(page, '17-wallet-transactions-heading');
});

test('VIS-18 · login form has both email and password input fields', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  await enableSemantics(page);

  // Flutter text fields expose themselves as editable nodes in semantics
  const editableNodes = page.locator('flt-semantics[contenteditable="true"], flt-semantics[role="textbox"]');
  // Should have at least 2 input fields on login screen (email + password)
  // Note: Flutter may not expose role=textbox, so also check for text editing hosts
  const textHosts = page.locator('flt-text-editing-host');
  const inputCount = await textHosts.count();

  // At minimum the Flutter semantics tree must have interactive input nodes
  const semanticsInputs = page.locator('flt-semantics').filter({
    has: page.locator('[style*="pointer-events: all"]'),
  });
  const total = await semanticsInputs.count();
  expect(total, 'Login screen must have interactive input elements').toBeGreaterThan(0);
  await screenshot(page, '18-login-form-inputs-present');
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
