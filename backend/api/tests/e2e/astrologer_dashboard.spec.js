// @ts-check
const { test, expect } = require('@playwright/test');

const API = 'http://localhost:3000';

async function registerAstrologer(request) {
  const email = `astro_dash_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/astrologer/auth/register`, {
    data: { name: 'Dashboard Astro', email, password: 'password123', rate_per_minute: 12 },
  });
  const body = await res.json();
  return { token: body.token, astrologer_id: body.astrologer_id, email };
}

// ── Profile ───────────────────────────────────────────────────────────────────

test('GET /astrologer/me returns profile for astrologer', async ({ request }) => {
  const { token, astrologer_id } = await registerAstrologer(request);
  const res = await request.get(`${API}/astrologer/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBe(astrologer_id);
  expect(body.name).toBe('Dashboard Astro');
  expect(body.rate_per_minute).toBe(12);
  expect(typeof body.is_available).toBe('boolean');
  expect(body.earnings_balance).toBeDefined();
});

test('GET /astrologer/me rejects seeker JWT', async ({ request }) => {
  // Register a seeker
  const seekerEmail = `seeker_${Date.now()}@test.com`;
  const seekerReg = await request.post(`${API}/auth/register`, {
    data: { email: seekerEmail, password: 'password123', name: 'Seeker' },
  });
  const { token } = await seekerReg.json();

  const res = await request.get(`${API}/astrologer/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(403);
});

test('GET /astrologer/me rejects unauthenticated request', async ({ request }) => {
  const res = await request.get(`${API}/astrologer/me`);
  expect(res.status()).toBe(401);
});

// ── Availability ──────────────────────────────────────────────────────────────

test('astrologer can toggle availability on', async ({ request }) => {
  const { token } = await registerAstrologer(request);
  const res = await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { available: true },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.is_available).toBe(true);
});

test('astrologer can toggle availability off', async ({ request }) => {
  const { token } = await registerAstrologer(request);
  // First go online
  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { available: true },
  });
  // Then go offline
  const res = await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { available: false },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).is_available).toBe(false);
});

test('availability endpoint rejects non-boolean value', async ({ request }) => {
  const { token } = await registerAstrologer(request);
  const res = await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { available: 'yes' },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/boolean/i);
});

test('available astrologer appears in public listing', async ({ request }) => {
  const { token } = await registerAstrologer(request);
  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { available: true },
  });
  const list = await request.get(`${API}/astrologer`);
  expect(list.status()).toBe(200);
  const astros = await list.json();
  expect(Array.isArray(astros)).toBe(true);
  // At least one available astrologer exists
  expect(astros.length).toBeGreaterThan(0);
  astros.forEach((a) => expect(a.is_available).toBe(true));
});

// ── Earnings ──────────────────────────────────────────────────────────────────

test('GET /astrologer/me/earnings returns balance and recent_calls', async ({ request }) => {
  const { token } = await registerAstrologer(request);
  const res = await request.get(`${API}/astrologer/me/earnings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(typeof body.balance).toBe('number');
  expect(Array.isArray(body.recent_calls)).toBe(true);
});

// ── Withdrawal ────────────────────────────────────────────────────────────────

test('withdrawal rejects amount exceeding balance', async ({ request }) => {
  const { token } = await registerAstrologer(request);
  const res = await request.post(`${API}/astrologer/me/withdrawal`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 99999 },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/insufficient/i);
});

test('withdrawal rejects zero amount', async ({ request }) => {
  const { token } = await registerAstrologer(request);
  const res = await request.post(`${API}/astrologer/me/withdrawal`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount: 0 },
  });
  expect(res.status()).toBe(400);
});
