// @ts-check
const { test, expect } = require('@playwright/test');

const API = 'http://localhost:3000';

async function registerSeeker(request) {
  const email = `hist_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: 'History User' },
  });
  return await res.json();
}

async function registerAstrologer(request) {
  const email = `astro_hist_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/astrologer/auth/register`, {
    data: { name: 'History Astro', email, password: 'password123', rate_per_minute: 10 },
  });
  return await res.json();
}

// ── Call history ──────────────────────────────────────────────────────────────

test('call history is empty for new user', async ({ request }) => {
  const { token } = await registerSeeker(request);
  const res = await request.get(`${API}/callHistory`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  // Response: { data: [], pagination: { total, page, limit, pages } }
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.data).toHaveLength(0);
  expect(body.pagination.total).toBe(0);
});

test('call history requires authentication', async ({ request }) => {
  const res = await request.get(`${API}/callHistory`);
  expect(res.status()).toBe(401);
});

test('completed call appears in history', async ({ request }) => {
  const seekerBody = await registerSeeker(request);
  const astroBody  = await registerAstrologer(request);

  // Go online + credit wallet
  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astroBody.token}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seekerBody.token}` },
    data: { amount: 200 },
  });

  // Start then immediately end
  const startBody = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seekerBody.token}` },
    data: { astrologer_id: astroBody.astrologer_id },
  })).json();

  await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seekerBody.token}` },
    data: { call_id: startBody.call_id },
  });

  // History should contain the completed call
  const histRes = await request.get(`${API}/callHistory`, {
    headers: { Authorization: `Bearer ${seekerBody.token}` },
  });
  expect(histRes.status()).toBe(200);
  const body = await histRes.json();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.data.length).toBeGreaterThan(0);
  const call = body.data.find((c) => c.id === startBody.call_id);
  expect(call).toBeDefined();
  expect(call.status).toBe('completed');
  expect(typeof call.duration_seconds).toBe('number');
  expect(typeof call.cost).toBe('number');
});
