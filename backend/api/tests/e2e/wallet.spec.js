// @ts-check
const { test, expect } = require('@playwright/test');

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

test('new user wallet balance is 0', async ({ request }) => {
  const { token } = await registerSeeker(request);
  const res = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).balance).toBe(0);
});

test('wallet/balance rejects unauthenticated request', async ({ request }) => {
  const res = await request.get(`${API}/wallet/balance`);
  expect(res.status()).toBe(401);
});

// ── Test credit (non-production only) ─────────────────────────────────────────

test('test-credit increases wallet balance', async ({ request }) => {
  const { token } = await registerSeeker(request);

  const credit = await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 100 },
  });
  expect(credit.status()).toBe(200);
  expect((await credit.json()).balance).toBe(100);

  // Balance endpoint reflects new amount
  const balance = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect((await balance.json()).balance).toBe(100);
});

test('test-credit rejects zero amount', async ({ request }) => {
  const { token } = await registerSeeker(request);
  const res = await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 0 },
  });
  expect(res.status()).toBe(400);
});

test('test-credit rejects negative amount', async ({ request }) => {
  const { token } = await registerSeeker(request);
  const res = await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: -50 },
  });
  expect(res.status()).toBe(400);
});

test('multiple credits accumulate correctly', async ({ request }) => {
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
  expect((await balance.json()).balance).toBe(80);
});
