// @ts-check
const { expect } = require('@playwright/test');
const { test, recordResult } = require('./fixtures');

const API = 'http://localhost:3000';

async function registerAstrologer(request) {
  const email = `prof_astro_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/astrologer/auth/register`, {
    data: { name: 'Profile Astro', email, password: 'password123', rate_per_minute: 15 },
  });
  return await res.json();
}

async function registerSeeker(request) {
  const email = `prof_seeker_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: 'Profile Seeker' },
  });
  return await res.json();
}

// ── Profile endpoint ──────────────────────────────────────────────────────────

test('GET /astrologer/:id returns full profile', async ({ request, screenshotPage }) => {
  const astro = await registerAstrologer(request);
  const res = await request.get(`${API}/astrologer/${astro.astrologer_id}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.id).toBe(astro.astrologer_id);
  expect(body.name).toBe('Profile Astro');
  expect(typeof body.rate_per_minute).toBe('number');
  expect(typeof body.is_available).toBe('boolean');
  expect(Array.isArray(body.reviews)).toBe(true);
  expect(body.rating_count).toBe(0);
  await recordResult(screenshotPage, 'GET /astrologer/:id returns full profile', res.status(), body);
});

test('GET /astrologer/:id returns 404 for unknown id', async ({ request, screenshotPage }) => {
  const res = await request.get(`${API}/astrologer/00000000-0000-0000-0000-000000000000`);
  expect(res.status()).toBe(404);
  const body = await res.json();
  await recordResult(screenshotPage, 'GET /astrologer/:id returns 404 for unknown id', res.status(), body);
});

test('GET /astrologer/:id shows avg_rating after a rated call', async ({ request, screenshotPage }) => {
  const astro   = await registerAstrologer(request);
  const seeker  = await registerSeeker(request);

  // Go online + credit
  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 200 },
  });

  // Complete a call
  const start = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { astrologer_id: astro.astrologer_id },
  })).json();
  await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { call_id: start.call_id },
  });

  // Rate it
  await request.post(`${API}/call/rate`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { call_id: start.call_id, rating: 4 },
  });

  // Profile now has rating
  const res = await request.get(`${API}/astrologer/${astro.astrologer_id}`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.avg_rating).toBe(4);
  expect(body.rating_count).toBe(1);
  expect(body.reviews.length).toBe(1);
  expect(body.reviews[0].rating).toBe(4);
  await recordResult(screenshotPage, 'GET /astrologer/:id shows avg_rating after a rated call', res.status(), body);
});

// ── Wallet transactions ───────────────────────────────────────────────────────

test('GET /wallet/transactions returns empty for new user', async ({ request, screenshotPage }) => {
  const seeker = await registerSeeker(request);
  const res = await request.get(`${API}/wallet/transactions`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.pagination).toBeDefined();
  await recordResult(screenshotPage, 'GET /wallet/transactions returns empty for new user', res.status(), body);
});

test('GET /wallet/transactions lists credits after top-up', async ({ request, screenshotPage }) => {
  const seeker = await registerSeeker(request);
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 50 },
  });
  const res = await request.get(`${API}/wallet/transactions`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data.length).toBeGreaterThan(0);
  expect(body.data[0].type).toBe('credit');
  await recordResult(screenshotPage, 'GET /wallet/transactions lists credits after top-up', res.status(), body);
});

test('GET /wallet/transactions requires auth', async ({ request, screenshotPage }) => {
  const res = await request.get(`${API}/wallet/transactions`);
  expect(res.status()).toBe(401);
  const body = await res.json();
  await recordResult(screenshotPage, 'GET /wallet/transactions requires auth', res.status(), body);
});
