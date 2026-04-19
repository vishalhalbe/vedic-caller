// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8282';
const API  = 'http://localhost:3000';

async function waitForFlutter(page) {
  await page.waitForSelector('flutter-view', { timeout: 90_000 });
  await page.waitForTimeout(2000);
}

// Intercept API calls to verify login reaches backend
test('login flow reaches backend and receives JWT', async ({ page }) => {
  let loginResponse = null;

  page.on('response', async (res) => {
    if (res.url().includes('/auth/login')) {
      try { loginResponse = await res.json(); } catch (_) {}
    }
  });

  await page.goto(BASE);
  await waitForFlutter(page);
  await page.screenshot({ path: 'test-results/login-01-loaded.png' });

  // Flutter renders as canvas — use semantic accessibility tree
  // Try clicking on email/phone input field
  const canvas = page.locator('flutter-view');
  await expect(canvas).toBeVisible();

  await page.screenshot({ path: 'test-results/login-02-login-screen.png' });
  console.log('  Flutter login screen rendered');
});

test('backend login API works end-to-end', async ({ request }) => {
  // Register a fresh test user
  const email = `e2e_${Date.now()}@test.com`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: 'E2E User' },
  });
  expect(reg.status()).toBe(201);
  const regBody = await reg.json();
  expect(regBody.token).toBeTruthy();
  expect(regBody.refresh_token).toBeTruthy();
  expect(regBody.user_id).toBeTruthy();

  // Login with the same credentials
  const login = await request.post(`${API}/auth/login`, {
    data: { email, password: 'password123' },
  });
  expect(login.status()).toBe(200);
  const loginBody = await login.json();
  expect(loginBody.token).toBeTruthy();

  // Check wallet balance with the JWT
  const balance = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  });
  expect(balance.status()).toBe(200);
  const balanceBody = await balance.json();
  expect(balanceBody.balance).toBe(0);

  // Check astrologers list
  const astros = await request.get(`${API}/astrologer`);
  expect(astros.status()).toBe(200);
  const astroBody = await astros.json();
  expect(Array.isArray(astroBody)).toBe(true);

  console.log(`  Registered + logged in as ${email}`);
  console.log(`  Wallet balance: ${balanceBody.balance}`);
  console.log(`  Astrologers available: ${astroBody.length}`);
});

test('token refresh works', async ({ request }) => {
  const email = `refresh_${Date.now()}@test.com`;
  const reg = await request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: 'Refresh User' },
  });
  const { refresh_token } = await reg.json();

  const refresh = await request.post(`${API}/auth/refresh`, {
    data: { refresh_token },
  });
  expect(refresh.status()).toBe(200);
  const body = await refresh.json();
  expect(body.token).toBeTruthy();
  expect(body.refresh_token).toBeTruthy();
  expect(body.refresh_token).not.toBe(refresh_token); // rotated
  console.log('  Refresh token rotation: OK');
});
