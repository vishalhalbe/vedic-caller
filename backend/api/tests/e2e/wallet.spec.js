// @ts-check
const { expect } = require('@playwright/test');
const { test, recordResult } = require('./fixtures');

const API = 'http://localhost:3000';

async function registerSeeker(request) {
  const email = `wallet_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: 'Wallet Seeker' },
  });
  const body = await res.json();
  return { token: body.token, user_id: body.user_id, email };
}

// ── Balance ───────────────────────────────────────────────────────────────────

test('new user wallet balance is 0', async ({ request, screenshotPage }) => {
  const { token } = await registerSeeker(request);
  const res = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.balance).toBe(0);
  await recordResult(screenshotPage, 'new user wallet balance is 0', res.status(), body);
});

test('wallet/balance rejects unauthenticated request', async ({ request, screenshotPage }) => {
  const res = await request.get(`${API}/wallet/balance`);
  expect(res.status()).toBe(401);
  const body = await res.json();
  await recordResult(screenshotPage, 'wallet/balance rejects unauthenticated request', res.status(), body);
});

// ── Test credit (non-production only) ─────────────────────────────────────────

test('test-credit increases wallet balance', async ({ request, screenshotPage }) => {
  const { token } = await registerSeeker(request);

  const credit = await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 100 },
  });
  expect(credit.status()).toBe(200);
  const creditBody = await credit.json();
  expect(creditBody.balance).toBe(100);

  const balance = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const balBody = await balance.json();
  expect(balBody.balance).toBe(100);
  await recordResult(screenshotPage, 'test-credit increases wallet balance', credit.status(), creditBody);
});

test('test-credit rejects zero amount', async ({ request, screenshotPage }) => {
  const { token } = await registerSeeker(request);
  const res = await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 0 },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  await recordResult(screenshotPage, 'test-credit rejects zero amount', res.status(), body);
});

test('test-credit rejects negative amount', async ({ request, screenshotPage }) => {
  const { token } = await registerSeeker(request);
  const res = await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: -50 },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  await recordResult(screenshotPage, 'test-credit rejects negative amount', res.status(), body);
});

test('multiple credits accumulate correctly', async ({ request, screenshotPage }) => {
  const { token } = await registerSeeker(request);
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 50 },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 30 },
  });
  const balance = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await balance.json();
  expect(body.balance).toBe(80);
  await recordResult(screenshotPage, 'multiple credits accumulate correctly', balance.status(), body);
});
