// @ts-check
const { expect } = require('@playwright/test');
const { test, recordResult } = require('./fixtures');

const API = 'http://localhost:3000';

async function registerSeeker(request) {
  const email = `rate_seeker_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: 'Rating Seeker' },
  });
  return await res.json();
}

async function registerAstrologer(request) {
  const email = `rate_astro_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/astrologer/auth/register`, {
    data: { name: 'Rating Astro', email, password: 'password123', rate_per_minute: 10 },
  });
  return await res.json();
}

async function completedCall(request, seekerToken, astroToken, astrologer_id) {
  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astroToken}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { amount: 200 },
  });
  const startBody = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { astrologer_id },
  })).json();
  await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { call_id: startBody.call_id },
  });
  return startBody.call_id;
}

// ── Rating ────────────────────────────────────────────────────────────────────

test('seeker can rate a completed call', async ({ request, screenshotPage }) => {
  const seekerBody = await registerSeeker(request);
  const astroBody  = await registerAstrologer(request);
  const callId = await completedCall(
    request, seekerBody.token, astroBody.token, astroBody.astrologer_id
  );

  const res = await request.post(`${API}/call/rate`, {
    headers: { Authorization: `Bearer ${seekerBody.token}` },
    data: { call_id: callId, rating: 5 },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.rating).toBe(5);
  expect(body.call_id).toBe(callId);
  await recordResult(screenshotPage, 'seeker can rate a completed call', res.status(), body);
});

test('rating rejects invalid value (0)', async ({ request, screenshotPage }) => {
  const seekerBody = await registerSeeker(request);
  const astroBody  = await registerAstrologer(request);
  const callId = await completedCall(
    request, seekerBody.token, astroBody.token, astroBody.astrologer_id
  );

  const res = await request.post(`${API}/call/rate`, {
    headers: { Authorization: `Bearer ${seekerBody.token}` },
    data: { call_id: callId, rating: 0 },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/1.+5/);
  await recordResult(screenshotPage, 'rating rejects invalid value (0)', res.status(), body);
});

test('rating rejects invalid value (6)', async ({ request, screenshotPage }) => {
  const seekerBody = await registerSeeker(request);
  const astroBody  = await registerAstrologer(request);
  const callId = await completedCall(
    request, seekerBody.token, astroBody.token, astroBody.astrologer_id
  );

  const res = await request.post(`${API}/call/rate`, {
    headers: { Authorization: `Bearer ${seekerBody.token}` },
    data: { call_id: callId, rating: 6 },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  await recordResult(screenshotPage, 'rating rejects invalid value (6)', res.status(), body);
});

test('duplicate rating returns 409', async ({ request, screenshotPage }) => {
  const seekerBody = await registerSeeker(request);
  const astroBody  = await registerAstrologer(request);
  const callId = await completedCall(
    request, seekerBody.token, astroBody.token, astroBody.astrologer_id
  );

  await request.post(`${API}/call/rate`, {
    headers: { Authorization: `Bearer ${seekerBody.token}` },
    data: { call_id: callId, rating: 4 },
  });

  const res = await request.post(`${API}/call/rate`, {
    headers: { Authorization: `Bearer ${seekerBody.token}` },
    data: { call_id: callId, rating: 3 },
  });
  expect(res.status()).toBe(409);
  const body = await res.json();
  expect(body.error).toMatch(/already rated/i);
  await recordResult(screenshotPage, 'duplicate rating returns 409', res.status(), body);
});

test('rating requires authentication', async ({ request, screenshotPage }) => {
  const res = await request.post(`${API}/call/rate`, {
    data: { call_id: 'anything', rating: 5 },
  });
  expect(res.status()).toBe(401);
  const body = await res.json();
  await recordResult(screenshotPage, 'rating requires authentication', res.status(), body);
});

test('rating returns 404 for wrong call', async ({ request, screenshotPage }) => {
  const seekerBody = await registerSeeker(request);
  const res = await request.post(`${API}/call/rate`, {
    headers: { Authorization: `Bearer ${seekerBody.token}` },
    data: { call_id: '00000000-0000-0000-0000-000000000000', rating: 5 },
  });
  expect(res.status()).toBe(404);
  const body = await res.json();
  await recordResult(screenshotPage, 'rating returns 404 for wrong call', res.status(), body);
});
