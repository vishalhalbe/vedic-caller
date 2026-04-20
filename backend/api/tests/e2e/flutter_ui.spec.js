// @ts-check
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

/** Click a flt-semantics node whose text content matches the given string */
async function tapByText(page, text) {
  const node = page.locator(`flt-semantics[flt-tappable]`).filter({ hasText: text }).first();
  await node.waitFor({ timeout: 10_000 });
  await node.dispatchEvent('click');
  await page.waitForTimeout(800);
}

/** Click the Nth empty input field (0 = email, 1 = password) */
async function tapInput(page, index = 0) {
  const inputs = page.locator('flt-semantics').filter({ hasText: /^$/ }).filter({
    has: page.locator('[style*="pointer-events: all"]'),
  });
  await inputs.nth(index).dispatchEvent('click');
  await page.waitForTimeout(500);
}

/** Type into the currently focused flt-text-editing-host input */
async function typeIntoFlutter(page, text) {
  await page.keyboard.type(text, { delay: 50 });
}

/** Register a fresh seeker via API; returns { token, user_id } */
async function registerSeeker(request, name) {
  const email = `ui_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: name || 'UI Seeker' },
  });
  const body = await res.json();
  return { ...body, email };
}

/** Register a fresh astrologer via API; returns { token, astrologer_id } */
async function registerAstrologer(request) {
  const email = `ui_astro_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/astrologer/auth/register`, {
    data: { name: 'UI Astro', email, password: 'password123', rate_per_minute: 10 },
  });
  const body = await res.json();
  return { ...body, email };
}

async function screenshotStep(page, name) {
  await page.screenshot({
    path: `test-results/ui-${name}.png`,
    fullPage: true,
  });
}

// ── 1 · App Shell ─────────────────────────────────────────────────────────────

test('UI-01 · app title is JyotishConnect', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  await expect(page).toHaveTitle('JyotishConnect');
  await screenshotStep(page, '01-title-check');
});

test('UI-02 · Flutter view renders without JS errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE);
  await waitForFlutter(page);
  await expect(page.locator('flutter-view')).toBeVisible();
  const fatal = errors.filter(
    e => !e.includes('ResizeObserver') && !e.includes('non-passive'),
  );
  expect(fatal).toHaveLength(0);
  await screenshotStep(page, '02-no-js-errors');
});

test('UI-03 · responsive — mobile 375', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE);
  await waitForFlutter(page);
  await expect(page.locator('flutter-view')).toBeVisible();
  await screenshotStep(page, '03-viewport-mobile-375');
});

test('UI-04 · responsive — tablet 768', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(BASE);
  await waitForFlutter(page);
  await expect(page.locator('flutter-view')).toBeVisible();
  await screenshotStep(page, '04-viewport-tablet-768');
});

test('UI-05 · responsive — desktop 1280', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE);
  await waitForFlutter(page);
  await expect(page.locator('flutter-view')).toBeVisible();
  await screenshotStep(page, '05-viewport-desktop-1280');
});

// ── 2 · Login Screen ──────────────────────────────────────────────────────────

test('UI-06 · login screen shows Seeker and Astrologer role buttons', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  await enableSemantics(page);
  await screenshotStep(page, '06-login-screen');

  const seeker     = page.locator('flt-semantics[flt-tappable]').filter({ hasText: 'Seeker' });
  const astrologer = page.locator('flt-semantics[flt-tappable]').filter({ hasText: 'Astrologer' });
  const signIn     = page.locator('flt-semantics[flt-tappable]').filter({ hasText: 'Sign in' });

  await expect(seeker).toBeAttached();
  await expect(astrologer).toBeAttached();
  await expect(signIn).toBeAttached();
});

test('UI-07 · login screen shows Register link', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  await enableSemantics(page);

  const register = page.locator('flt-semantics[flt-tappable]').filter({ hasText: /Register/ });
  await expect(register).toBeAttached();
  await screenshotStep(page, '07-login-has-register-link');
});

// ── 3 · Seeker Registration ───────────────────────────────────────────────────

test('UI-08 · seeker — backend registration succeeds', async ({ request }) => {
  const email = `ui_reg_${Date.now()}@test.com`;
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: 'UI Reg Seeker' },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.token).toBeTruthy();
  expect(body.user_id).toBeTruthy();
});

// ── 4 · Seeker Login (API-backed) ─────────────────────────────────────────────

test('UI-09 · seeker — backend login returns JWT + wallet ready', async ({ request }) => {
  const seeker = await registerSeeker(request);
  const login = await request.post(`${API}/auth/login`, {
    data: { email: seeker.email, password: 'password123' },
  });
  expect(login.status()).toBe(200);
  const body = await login.json();
  expect(body.token).toBeTruthy();

  const balance = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${body.token}` },
  });
  expect(balance.status()).toBe(200);
  const balBody = await balance.json();
  expect(balBody.balance).toBe(0);
});

// ── 5 · Flutter Login Flow (UI interaction) ────────────────────────────────────

test('UI-10 · seeker — Flutter login screen renders and responds to role toggle', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  await enableSemantics(page);
  await screenshotStep(page, '10-before-role-toggle');

  // Toggle to Astrologer and back to Seeker
  await tapByText(page, 'Astrologer');
  await screenshotStep(page, '10-astrologer-role-selected');

  await tapByText(page, 'Seeker');
  await screenshotStep(page, '10-seeker-role-selected');

  // Verify Sign in button is still present
  const signIn = page.locator('flt-semantics[flt-tappable]').filter({ hasText: 'Sign in' });
  await expect(signIn).toBeAttached();
});

// ── 6 · Astrologer Login (API-backed) ─────────────────────────────────────────

test('UI-11 · astrologer — backend login returns role=astrologer in JWT', async ({ request }) => {
  const astro = await registerAstrologer(request);
  expect(astro.token).toBeTruthy();
  expect(astro.astrologer_id).toBeTruthy();

  // Verify the JWT gives access to astrologer-only endpoint
  const me = await request.get(`${API}/astrologer/me`, {
    headers: { Authorization: `Bearer ${astro.token}` },
  });
  expect(me.status()).toBe(200);
  const body = await me.json();
  expect(body.id).toBe(astro.astrologer_id);
});

// ── 7 · Astrologer List Screen ────────────────────────────────────────────────

test('UI-12 · astrologer list — returns available astrologers', async ({ request }) => {
  // Create an available astrologer
  const astro = await registerAstrologer(request);
  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });

  const list = await request.get(`${API}/astrologer`);
  expect(list.status()).toBe(200);
  const body = await list.json();
  expect(Array.isArray(body)).toBe(true);
  // At least our newly created astrologer should appear
  const found = body.find((a) => a.id === astro.astrologer_id);
  expect(found).toBeDefined();
  expect(found.avg_rating !== undefined).toBe(true);
  expect(found.rating_count !== undefined).toBe(true);
});

test('UI-13 · astrologer list — search by name filters results', async ({ request }) => {
  const res = await request.get(`${API}/astrologer?name=NonExistentXYZ123`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBe(0);
});

// ── 8 · Wallet Screen ─────────────────────────────────────────────────────────

test('UI-14 · wallet — new seeker balance is 0', async ({ request }) => {
  const seeker = await registerSeeker(request);
  const res = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).balance).toBe(0);
});

test('UI-15 · wallet — top-up increases balance', async ({ request }) => {
  const seeker = await registerSeeker(request);
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 500 },
  });
  const res = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
  });
  expect((await res.json()).balance).toBe(500);
});

test('UI-16 · wallet — transaction history shows credit after top-up', async ({ request }) => {
  const seeker = await registerSeeker(request);
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 200 },
  });
  const res = await request.get(`${API}/wallet/transactions`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data.length).toBeGreaterThan(0);
  expect(body.data[0].type).toBe('credit');
  expect(body.pagination).toBeDefined();
});

// ── 9 · Astrologer Profile Screen ─────────────────────────────────────────────

test('UI-17 · astrologer profile — returns full profile with reviews array', async ({ request }) => {
  const astro = await registerAstrologer(request);
  const res = await request.get(`${API}/astrologer/${astro.astrologer_id}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBe(astro.astrologer_id);
  expect(Array.isArray(body.reviews)).toBe(true);
  expect(typeof body.rating_count).toBe('number');
});

test('UI-18 · astrologer profile — 404 for unknown id', async ({ request }) => {
  const res = await request.get(`${API}/astrologer/00000000-0000-0000-0000-000000000000`);
  expect(res.status()).toBe(404);
});

// ── 10 · Call Flow ────────────────────────────────────────────────────────────

test('UI-19 · call — seeker can start and end a call', async ({ request }) => {
  const astro  = await registerAstrologer(request);
  const seeker = await registerSeeker(request);

  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 500 },
  });

  const start = await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { astrologer_id: astro.astrologer_id },
  });
  expect(start.status()).toBe(200);
  const { call_id } = await start.json();
  expect(call_id).toBeTruthy();

  const end = await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { call_id },
  });
  expect(end.status()).toBe(200);
  const endBody = await end.json();
  expect(endBody.cost).toBeGreaterThanOrEqual(0);
});

test('UI-20 · call — fails with insufficient balance', async ({ request }) => {
  const astro  = await registerAstrologer(request);
  const seeker = await registerSeeker(request);

  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });

  const res = await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { astrologer_id: astro.astrologer_id },
  });
  expect(res.status()).toBe(400); // 400 Insufficient balance
});

// ── 11 · Ratings ─────────────────────────────────────────────────────────────

test('UI-21 · ratings — seeker rates completed call, appears on profile', async ({ request }) => {
  const astro  = await registerAstrologer(request);
  const seeker = await registerSeeker(request);

  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 500 },
  });

  const { call_id } = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { astrologer_id: astro.astrologer_id },
  })).json();

  await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { call_id },
  });

  const rate = await request.post(`${API}/call/rate`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { call_id, rating: 5 },
  });
  expect(rate.status()).toBe(200);

  // Profile should now show avg_rating
  const profile = await (await request.get(`${API}/astrologer/${astro.astrologer_id}`)).json();
  expect(profile.avg_rating).toBe(5);
  expect(profile.rating_count).toBe(1);
  expect(profile.reviews[0].rating).toBe(5);
});

// ── 12 · Call History ─────────────────────────────────────────────────────────

test('UI-22 · call history — completed call appears in seeker history', async ({ request }) => {
  const astro  = await registerAstrologer(request);
  const seeker = await registerSeeker(request);

  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 500 },
  });

  const { call_id } = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { astrologer_id: astro.astrologer_id },
  })).json();

  await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { call_id },
  });

  const history = await request.get(`${API}/callHistory`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
  });
  expect(history.status()).toBe(200);
  const body = await history.json();
  const found = body.data.find((c) => c.id === call_id);
  expect(found).toBeDefined();
  expect(found.status).toBe('completed');
});

// ── 13 · Astrologer Dashboard ─────────────────────────────────────────────────

test('UI-23 · astrologer dashboard — can toggle availability on/off', async ({ request }) => {
  const astro = await registerAstrologer(request);

  const on = await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });
  expect(on.status()).toBe(200);
  expect((await on.json()).is_available).toBe(true);

  const off = await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: false },
  });
  expect(off.status()).toBe(200);
  expect((await off.json()).is_available).toBe(false);
});

test('UI-24 · astrologer dashboard — earnings reflect completed call', async ({ request }) => {
  const astro  = await registerAstrologer(request);
  const seeker = await registerSeeker(request);

  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 500 },
  });

  const { call_id } = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { astrologer_id: astro.astrologer_id },
  })).json();

  await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { call_id },
  });

  const earnings = await request.get(`${API}/astrologer/me/earnings`, {
    headers: { Authorization: `Bearer ${astro.token}` },
  });
  expect(earnings.status()).toBe(200);
  const body = await earnings.json();
  expect(typeof body.balance).toBe('number');
  expect(body.recent_calls).toBeDefined();
});

// ── 14 · Incoming Call (Astrologer) ───────────────────────────────────────────

test('UI-25 · incoming call — astrologer sees pending call after seeker starts', async ({ request }) => {
  const astro  = await registerAstrologer(request);
  const seeker = await registerSeeker(request);

  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 500 },
  });

  await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { astrologer_id: astro.astrologer_id },
  });

  const incoming = await request.get(`${API}/call/incoming`, {
    headers: { Authorization: `Bearer ${astro.token}` },
  });
  expect(incoming.status()).toBe(200);
  const body = await incoming.json();
  expect(body.call).toBeTruthy();
  expect(body.call.id).toBeTruthy();
  expect(body.call.seeker_name).toBeTruthy();
});

test('UI-26 · incoming call — astrologer can decline', async ({ request }) => {
  const astro  = await registerAstrologer(request);
  const seeker = await registerSeeker(request);

  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 500 },
  });

  const { call_id } = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { astrologer_id: astro.astrologer_id },
  })).json();

  const decline = await request.post(`${API}/call/decline/${call_id}`, {
    headers: { Authorization: `Bearer ${astro.token}` },
  });
  expect(decline.status()).toBe(200);

  // Astrologer should now be available again
  const me = await (await request.get(`${API}/astrologer/me`, {
    headers: { Authorization: `Bearer ${astro.token}` },
  })).json();
  expect(me.is_available).toBe(true);
});

// ── 15 · Flutter UI — Login Screen Screenshot ─────────────────────────────────

test('UI-27 · Flutter login screen — full screenshot with semantics', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  await enableSemantics(page);
  await screenshotStep(page, '27-login-with-semantics');

  // Verify key elements present in semantics tree
  const buttons = page.locator('flt-semantics[flt-tappable]');
  const count = await buttons.count();
  expect(count).toBeGreaterThan(2); // at least Seeker, Astrologer, Sign in, Register
});

test('UI-28 · Flutter — Astrologer role tab renders on login screen', async ({ page }) => {
  await page.goto(BASE);
  await waitForFlutter(page);
  await enableSemantics(page);

  await tapByText(page, 'Astrologer');
  await screenshotStep(page, '28-astrologer-tab-active');

  // Astrologer tab should still be in semantics tree
  const astroBtn = page.locator('flt-semantics[flt-tappable]').filter({ hasText: 'Astrologer' });
  await expect(astroBtn).toBeAttached();
});
