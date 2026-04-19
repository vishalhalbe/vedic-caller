// @ts-check
const { test, expect } = require('@playwright/test');

const API = 'http://localhost:3000';

async function registerSeeker(request) {
  const email = `seeker_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: 'Call Seeker' },
  });
  const body = await res.json();
  return { token: body.token, user_id: body.user_id };
}

async function registerAstrologer(request) {
  const email = `astro_call_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/astrologer/auth/register`, {
    data: { name: 'Call Astrologer', email, password: 'password123', rate_per_minute: 10 },
  });
  const body = await res.json();
  return { token: body.token, astrologer_id: body.astrologer_id };
}

async function setAvailable(request, astroToken, available) {
  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astroToken}` },
    data: { available },
  });
}

async function creditWallet(request, seekerToken, amount) {
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { amount },
  });
}

// ── Start call validations ────────────────────────────────────────────────────

test('start call fails when astrologer_id missing', async ({ request }) => {
  const { token } = await registerSeeker(request);
  const res = await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/astrologer_id/i);
});

test('start call fails when astrologer not found', async ({ request }) => {
  const { token } = await registerSeeker(request);
  await creditWallet(request, token, 100);
  const res = await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { astrologer_id: '00000000-0000-0000-0000-000000000000' },
  });
  expect(res.status()).toBe(404);
});

test('start call fails when astrologer is offline', async ({ request }) => {
  const { token: seekerToken } = await registerSeeker(request);
  const { astrologer_id } = await registerAstrologer(request);
  await creditWallet(request, seekerToken, 100);

  // Astrologer is offline by default after register
  const res = await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { astrologer_id },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/not available/i);
});

test('start call fails with insufficient balance', async ({ request }) => {
  const { token: seekerToken } = await registerSeeker(request);
  const { token: astroToken, astrologer_id } = await registerAstrologer(request);
  await setAvailable(request, astroToken, true);
  // No wallet credit — balance stays at 0

  const res = await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { astrologer_id },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/insufficient/i);
});

// ── Full call lifecycle ───────────────────────────────────────────────────────

test('start + end call deducts wallet and returns summary', async ({ request }) => {
  const { token: seekerToken } = await registerSeeker(request);
  const { token: astroToken, astrologer_id } = await registerAstrologer(request);
  await setAvailable(request, astroToken, true);
  await creditWallet(request, seekerToken, 200);

  // Start call
  const startRes = await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { astrologer_id },
  });
  expect(startRes.status()).toBe(200);
  const startBody = await startRes.json();
  expect(startBody.call_id).toBeTruthy();
  expect(startBody.channel).toBeTruthy();
  expect(startBody.token).toBeTruthy();

  // End call immediately
  const endRes = await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { call_id: startBody.call_id },
  });
  expect(endRes.status()).toBe(200);
  const endBody = await endRes.json();
  // finaliseCall returns { duration, cost } — no status field on response
  expect(typeof endBody.duration).toBe('number');
  expect(typeof endBody.cost).toBe('number');
  expect(endBody.cost).toBeGreaterThanOrEqual(0);
});

// ── Incoming call polling ─────────────────────────────────────────────────────

test('GET /call/incoming returns null when no active call', async ({ request }) => {
  const { token: astroToken } = await registerAstrologer(request);
  const res = await request.get(`${API}/call/incoming`, {
    headers: { Authorization: `Bearer ${astroToken}` },
  });
  expect(res.status()).toBe(200);
  expect((await res.json()).call).toBeNull();
});

test('GET /call/incoming is rejected for seekers', async ({ request }) => {
  const { token } = await registerSeeker(request);
  const res = await request.get(`${API}/call/incoming`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(403);
});

// ── Decline call ─────────────────────────────────────────────────────────────

test('astrologer can decline an active call', async ({ request }) => {
  const { token: seekerToken } = await registerSeeker(request);
  const { token: astroToken, astrologer_id } = await registerAstrologer(request);
  await setAvailable(request, astroToken, true);
  await creditWallet(request, seekerToken, 200);

  const startBody = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { astrologer_id },
  })).json();

  const declineRes = await request.post(`${API}/call/decline/${startBody.call_id}`, {
    headers: { Authorization: `Bearer ${astroToken}` },
  });
  expect(declineRes.status()).toBe(200);
  expect((await declineRes.json()).status).toBe('declined');
});

test('decline rejects wrong astrologer', async ({ request }) => {
  const { token: seekerToken } = await registerSeeker(request);
  const { token: astroToken, astrologer_id } = await registerAstrologer(request);
  const { token: otherAstroToken } = await registerAstrologer(request);

  await setAvailable(request, astroToken, true);
  await creditWallet(request, seekerToken, 200);

  const startBody = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { astrologer_id },
  })).json();

  // Different astrologer tries to decline
  const res = await request.post(`${API}/call/decline/${startBody.call_id}`, {
    headers: { Authorization: `Bearer ${otherAstroToken}` },
  });
  expect(res.status()).toBe(404);
});
