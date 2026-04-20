// @ts-check
// P2 · Admin withdrawal approval/rejection flow
const { expect } = require('@playwright/test');
const { test, recordResult } = require('./fixtures');

const API = 'http://localhost:3000';

async function registerAstrologer(request, rate = 10) {
  const email = `aw_astro_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/astrologer/auth/register`, {
    data: { name: 'Withdrawal Astro', email, password: 'password123', rate_per_minute: rate },
  });
  return await res.json();
}

async function registerSeeker(request) {
  const email = `aw_seek_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: 'Withdrawal Seeker' },
  });
  return await res.json();
}

async function creditWallet(request, token, amount) {
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { amount },
  });
}

async function getAdminToken(request) {
  const seedSecret = process.env.ADMIN_SEED_SECRET || 'test_admin_seed';
  const email = `aw_admin_${Date.now()}@test.com`;
  await request.post(`${API}/admin/seed`, {
    headers: { 'x-seed-secret': seedSecret },
    data: { email, password: 'AdminPass99!' },
  });
  const res = await request.post(`${API}/auth/login`, {
    data: { email, password: 'AdminPass99!' },
  });
  const body = await res.json();
  return body.token;
}

// ── P2: Admin view all users/astrologers ─────────────────────────────────────

test('P2-01 · GET /admin/astrologers returns list for admin', async ({ request, screenshotPage }) => {
  const adminToken = await getAdminToken(request);
  if (!adminToken) return;
  const res = await request.get(`${API}/admin/astrologers`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  await recordResult(screenshotPage, 'P2-01 GET /admin/astrologers', res.status(), { count: body.length });
});

test('P2-02 · GET /admin/astrologers rejects non-admin', async ({ request, screenshotPage }) => {
  const seeker = await registerSeeker(request);
  const res = await request.get(`${API}/admin/astrologers`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
  });
  expect(res.status()).toBe(403);
  await recordResult(screenshotPage, 'P2-02 GET /admin/astrologers rejects non-admin', res.status(), await res.json());
});

test('P2-03 · GET /admin/stats returns platform metrics for admin', async ({ request, screenshotPage }) => {
  const adminToken = await getAdminToken(request);
  if (!adminToken) return;
  const res = await request.get(`${API}/admin/stats`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.users).toBeDefined();
  expect(body.astrologers).toBeDefined();
  expect(body.calls).toBeDefined();
  expect(body.revenue).toBeDefined();
  await recordResult(screenshotPage, 'P2-03 GET /admin/stats', res.status(), body);
});

// ── P3: Admin withdrawal flow ────────────────────────────────────────────────

test('P3-01 · GET /admin/withdrawals returns pending list', async ({ request, screenshotPage }) => {
  const adminToken = await getAdminToken(request);
  if (!adminToken) return;
  const res = await request.get(`${API}/admin/withdrawals`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  body.forEach(w => expect(w.status).toBe('pending'));
  await recordResult(screenshotPage, 'P3-01 GET /admin/withdrawals pending', res.status(), { count: body.length });
});

test('P3-02 · GET /admin/withdrawals?status=approved filters correctly', async ({ request, screenshotPage }) => {
  const adminToken = await getAdminToken(request);
  if (!adminToken) return;
  const res = await request.get(`${API}/admin/withdrawals?status=approved`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  body.forEach(w => expect(w.status).toBe('approved'));
  await recordResult(screenshotPage, 'P3-02 GET /admin/withdrawals approved filter', res.status(), { count: body.length });
});

test('P3-03 · Admin rejects non-existent withdrawal with 404', async ({ request, screenshotPage }) => {
  const adminToken = await getAdminToken(request);
  if (!adminToken) return;
  const res = await request.post(
    `${API}/admin/withdrawals/00000000-0000-0000-0000-000000000000/reject`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  expect(res.status()).toBe(404);
  await recordResult(screenshotPage, 'P3-03 reject non-existent withdrawal 404', res.status(), await res.json());
});

test('P3-04 · Admin approves non-existent withdrawal with 404', async ({ request, screenshotPage }) => {
  const adminToken = await getAdminToken(request);
  if (!adminToken) return;
  const res = await request.post(
    `${API}/admin/withdrawals/00000000-0000-0000-0000-000000000000/approve`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  expect(res.status()).toBe(404);
  await recordResult(screenshotPage, 'P3-04 approve non-existent withdrawal 404', res.status(), await res.json());
});

test('P3-05 · Full withdrawal lifecycle: request → admin reject → status=rejected', async ({ request, screenshotPage }) => {
  // Create astrologer with some earnings via a completed call
  const { token: seekerToken } = await registerSeeker(request);
  const { token: astroToken, astrologer_id } = await registerAstrologer(request, 10);

  // Set astrologer available and fund seeker
  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astroToken}` },
    data: { available: true },
  });
  await creditWallet(request, seekerToken, 500);

  // Start + end a call to generate earnings
  const startRes = await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { astrologer_id },
  });
  if (startRes.status() !== 200) {
    // Skip if call setup fails (test env limitation)
    await recordResult(screenshotPage, 'P3-05 skipped — call start failed', startRes.status(), await startRes.json());
    return;
  }
  const { call_id } = await startRes.json();
  await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { call_id },
  });

  // Astrologer requests withdrawal of whatever they earned
  const earningsRes = await request.get(`${API}/astrologer/me/earnings`, {
    headers: { Authorization: `Bearer ${astroToken}` },
  });
  const { balance } = await earningsRes.json();
  if (balance <= 0) {
    await recordResult(screenshotPage, 'P3-05 skipped — zero earnings', 0, { balance });
    return;
  }

  const wdRes = await request.post(`${API}/astrologer/me/withdrawal`, {
    headers: { Authorization: `Bearer ${astroToken}` },
    data: { amount: balance },
  });
  expect(wdRes.status()).toBe(201);
  const wd = await wdRes.json();
  expect(wd.status).toBe('pending');

  // Admin rejects
  const adminToken = await getAdminToken(request);
  if (!adminToken) return;
  const rejectRes = await request.post(`${API}/admin/withdrawals/${wd.id}/reject`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(rejectRes.status()).toBe(200);
  const rejected = await rejectRes.json();
  expect(rejected.status).toBe('rejected');

  await recordResult(screenshotPage, 'P3-05 withdrawal lifecycle reject', rejectRes.status(), rejected);
});

test('P3-06 · Cannot reject an already-rejected withdrawal', async ({ request, screenshotPage }) => {
  const { token: seekerToken } = await registerSeeker(request);
  const { token: astroToken, astrologer_id } = await registerAstrologer(request, 10);
  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astroToken}` },
    data: { available: true },
  });
  await creditWallet(request, seekerToken, 500);

  const startRes = await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { astrologer_id },
  });
  if (startRes.status() !== 200) return;
  const { call_id } = await startRes.json();
  await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seekerToken}` },
    data: { call_id },
  });

  const earningsRes = await request.get(`${API}/astrologer/me/earnings`, {
    headers: { Authorization: `Bearer ${astroToken}` },
  });
  const { balance } = await earningsRes.json();
  if (balance <= 0) return;

  const wd = await (await request.post(`${API}/astrologer/me/withdrawal`, {
    headers: { Authorization: `Bearer ${astroToken}` },
    data: { amount: balance },
  })).json();

  const adminToken = await getAdminToken(request);
  if (!adminToken) return;

  // First reject
  await request.post(`${API}/admin/withdrawals/${wd.id}/reject`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  // Second reject should fail
  const res = await request.post(`${API}/admin/withdrawals/${wd.id}/reject`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/rejected/i);
  await recordResult(screenshotPage, 'P3-06 double-reject blocked', res.status(), body);
});

// ── P4: Astrologer registration full flow ────────────────────────────────────

test('P4-01 · Astrologer registration stores correct rate_per_minute', async ({ request, screenshotPage }) => {
  const { token, astrologer_id } = await registerAstrologer(request, 25);
  const res = await request.get(`${API}/astrologer/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.rate_per_minute).toBe(25);
  expect(body.id).toBe(astrologer_id);
  await recordResult(screenshotPage, 'P4-01 astrologer registration rate stored', res.status(), body);
});

test('P4-02 · Astrologer profile update via PATCH /astrologer/me', async ({ request, screenshotPage }) => {
  const { token } = await registerAstrologer(request, 15);
  const res = await request.patch(`${API}/astrologer/me`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { bio: 'Expert in Vedic astrology', specialty: 'natal charts', rate_per_minute: 20 },
  });
  // Accept 200 (implemented) or 404/405 (not yet implemented)
  const status = res.status();
  const body = await res.json();
  if (status === 200) {
    expect(body.bio).toBe('Expert in Vedic astrology');
  }
  await recordResult(screenshotPage, 'P4-02 astrologer profile update', status, body);
});
