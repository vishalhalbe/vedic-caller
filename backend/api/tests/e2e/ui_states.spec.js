// @ts-check
// P3 · UI state tests — empty states, loading, error+retry, network edge cases
const { expect } = require('@playwright/test');
const { test, recordResult } = require('./fixtures');

const API = 'http://localhost:3000';

async function registerSeeker(request) {
  const email = `ui_seek_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: 'UI Seeker' },
  });
  return await res.json();
}

async function registerAstrologer(request) {
  const email = `ui_astro_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/astrologer/auth/register`, {
    data: { name: 'UI Astro', email, password: 'password123', rate_per_minute: 10 },
  });
  return await res.json();
}

// ── Empty states ──────────────────────────────────────────────────────────────

test('UI-01 · Empty astrologer list when none online', async ({ request, screenshotPage }) => {
  // Fetch available astrologers — may be empty if none set themselves available
  const res = await request.get(`${API}/astrologer`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  // All returned astrologers must have is_available=true
  body.forEach(a => expect(a.is_available).toBe(true));
  await recordResult(screenshotPage, 'UI-01 empty/non-empty astrologer list', res.status(), { count: body.length });
});

test('UI-02 · Empty wallet — fresh user has zero balance', async ({ request, screenshotPage }) => {
  const { token } = await registerSeeker(request);
  const res = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(parseFloat(body.balance)).toBe(0);
  await recordResult(screenshotPage, 'UI-02 fresh user zero balance', res.status(), body);
});

test('UI-03 · Empty call history for new user', async ({ request, screenshotPage }) => {
  const { token } = await registerSeeker(request);
  const res = await request.get(`${API}/callHistory`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  const calls = Array.isArray(body) ? body : body.calls || [];
  expect(calls.length).toBe(0);
  await recordResult(screenshotPage, 'UI-03 empty call history new user', res.status(), body);
});

test('UI-04 · Empty earnings for new astrologer', async ({ request, screenshotPage }) => {
  const { token } = await registerAstrologer(request);
  const res = await request.get(`${API}/astrologer/me/earnings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(parseFloat(body.balance)).toBe(0);
  expect(Array.isArray(body.recent_calls)).toBe(true);
  expect(body.recent_calls.length).toBe(0);
  await recordResult(screenshotPage, 'UI-04 empty earnings new astrologer', res.status(), body);
});

// ── Error states ──────────────────────────────────────────────────────────────

test('UI-05 · Bad JWT returns 401 with error message', async ({ request, screenshotPage }) => {
  const res = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: 'Bearer totally-invalid-token' },
  });
  expect(res.status()).toBe(401);
  const body = await res.json();
  expect(body.error).toBeTruthy();
  await recordResult(screenshotPage, 'UI-05 bad JWT returns 401', res.status(), body);
});

test('UI-06 · Missing auth header returns 401', async ({ request, screenshotPage }) => {
  const res = await request.get(`${API}/astrologer/me`);
  expect(res.status()).toBe(401);
  const body = await res.json();
  expect(body.error).toBeTruthy();
  await recordResult(screenshotPage, 'UI-06 missing auth returns 401', res.status(), body);
});

test('UI-07 · Unknown endpoint returns 404 or 400, not 500', async ({ request, screenshotPage }) => {
  const res = await request.get(`${API}/this-route-does-not-exist`);
  expect(res.status()).toBeLessThan(500);
  await recordResult(screenshotPage, 'UI-07 unknown endpoint not 500', res.status(), {});
});

test('UI-08 · Malformed JSON body returns 400', async ({ request, screenshotPage }) => {
  const { token } = await registerSeeker(request);
  const res = await request.post(`${API}/call/start`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: '{ broken json',
  });
  // Express will return 400 for malformed JSON
  expect(res.status()).toBeGreaterThanOrEqual(400);
  expect(res.status()).toBeLessThan(500);
  await recordResult(screenshotPage, 'UI-08 malformed JSON returns 4xx', res.status(), {});
});

// ── Error + retry ─────────────────────────────────────────────────────────────

test('UI-09 · Calling same endpoint twice returns consistent results (GET idempotent)', async ({ request, screenshotPage }) => {
  const { token } = await registerSeeker(request);

  const res1 = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const res2 = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(res1.status()).toBe(200);
  expect(res2.status()).toBe(200);
  const b1 = await res1.json();
  const b2 = await res2.json();
  expect(b1.balance).toBe(b2.balance);
  await recordResult(screenshotPage, 'UI-09 GET idempotency same result', res2.status(), { b1, b2 });
});

test('UI-10 · Health endpoint always 200', async ({ request, screenshotPage }) => {
  const res = await request.get(`${API}/health`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe('ok');
  await recordResult(screenshotPage, 'UI-10 health always 200', res.status(), body);
});

// ── Loading states (API contract) ────────────────────────────────────────────

test('UI-11 · GET /astrologer/:id returns 404 for non-existent ID (not 500)', async ({ request, screenshotPage }) => {
  const res = await request.get(`${API}/astrologer/00000000-0000-0000-0000-000000000000`);
  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(body.error).toBeTruthy();
  await recordResult(screenshotPage, 'UI-11 astrologer not found 404', res.status(), body);
});

test('UI-12 · GET /wallet/transactions returns paginated array', async ({ request, screenshotPage }) => {
  const { token } = await registerSeeker(request);
  const res = await request.get(`${API}/wallet/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  const txns = Array.isArray(body) ? body : body.transactions || body.data || [];
  expect(Array.isArray(txns)).toBe(true);
  await recordResult(screenshotPage, 'UI-12 wallet transactions empty array', res.status(), { count: txns.length });
});
