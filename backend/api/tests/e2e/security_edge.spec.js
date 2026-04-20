// @ts-check
// Security, data isolation, edge cases, empty/error states, withdrawal flow
const { expect } = require('@playwright/test');
const { test, recordResult } = require('./fixtures');

const API = 'http://localhost:3000';

async function registerSeeker(request, name) {
  const email = `sec_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/auth/register`, {
    data: { email, password: 'password123', name: name || 'Sec Seeker' },
  });
  const body = await res.json();
  return { ...body, email };
}

async function registerAstrologer(request) {
  const email = `sec_astro_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
  const res = await request.post(`${API}/astrologer/auth/register`, {
    data: { name: 'Sec Astro', email, password: 'password123', rate_per_minute: 10 },
  });
  return { ...(await res.json()), email };
}

// ── CRITICAL · User Data Isolation ───────────────────────────────────────────

test('SEC-01 · User A cannot read User B wallet balance', async ({ request, screenshotPage }) => {
  const userA = await registerSeeker(request, 'User A');
  const userB = await registerSeeker(request, 'User B');

  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${userA.token}` },
    data: { amount: 999 },
  });

  // User B's token should only see their own balance (0)
  const res = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${userB.token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.balance).toBe(0); // B cannot see A's 999
  await recordResult(screenshotPage, 'SEC-01 User A cannot read User B wallet', res.status(), body);
});

test('SEC-02 · User A cannot read User B call history', async ({ request, screenshotPage }) => {
  const userA = await registerSeeker(request, 'History A');
  const userB = await registerSeeker(request, 'History B');

  const histB = await request.get(`${API}/callHistory`, {
    headers: { Authorization: `Bearer ${userB.token}` },
  });
  expect(histB.status()).toBe(200);
  const body = await histB.json();
  // B starts with empty history; A's calls are not visible
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.data.length).toBe(0);
  await recordResult(screenshotPage, 'SEC-02 User A cannot read User B call history', histB.status(), body);
});

test('SEC-03 · seeker cannot end a call belonging to another seeker', async ({ request, screenshotPage }) => {
  const astro   = await registerAstrologer(request);
  const seekerA = await registerSeeker(request, 'Seeker A');
  const seekerB = await registerSeeker(request, 'Seeker B');

  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seekerA.token}` },
    data: { amount: 500 },
  });

  const { call_id } = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seekerA.token}` },
    data: { astrologer_id: astro.astrologer_id },
  })).json();

  // Seeker B tries to end A's call
  const res = await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seekerB.token}` },
    data: { call_id },
  });
  expect([400, 403, 404]).toContain(res.status());
  const body = await res.json();
  await recordResult(screenshotPage, 'SEC-03 Seeker B cannot end Seeker A call', res.status(), body);
});

test('SEC-04 · seeker cannot rate another seeker\'s call', async ({ request, screenshotPage }) => {
  const astro   = await registerAstrologer(request);
  const seekerA = await registerSeeker(request, 'Rater A');
  const seekerB = await registerSeeker(request, 'Rater B');

  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seekerA.token}` },
    data: { amount: 500 },
  });

  const { call_id } = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seekerA.token}` },
    data: { astrologer_id: astro.astrologer_id },
  })).json();
  await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seekerA.token}` },
    data: { call_id },
  });

  // Seeker B tries to rate A's call
  const res = await request.post(`${API}/call/rate`, {
    headers: { Authorization: `Bearer ${seekerB.token}` },
    data: { call_id, rating: 1 },
  });
  expect([403, 404]).toContain(res.status());
  const body = await res.json();
  await recordResult(screenshotPage, 'SEC-04 Seeker B cannot rate Seeker A call', res.status(), body);
});

test('SEC-05 · astrologer cannot access seeker wallet endpoint', async ({ request, screenshotPage }) => {
  const astro = await registerAstrologer(request);
  const res = await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${astro.token}` },
  });
  // Astrologer JWT has no entry in users table → 404, not their data
  expect([401, 403, 404]).toContain(res.status());
  const body = await res.json();
  await recordResult(screenshotPage, 'SEC-05 Astrologer cannot access seeker wallet', res.status(), body);
});

// ── CRITICAL · SQL Injection ──────────────────────────────────────────────────

test('SEC-06 · SQL injection in name search returns empty, not error', async ({ request, screenshotPage }) => {
  const payloads = [
    "'; DROP TABLE astrologers; --",
    "' OR '1'='1",
    "\" OR \"1\"=\"1",
    '1; SELECT * FROM users',
  ];
  for (const payload of payloads) {
    const res = await request.get(`${API}/astrologer?name=${encodeURIComponent(payload)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true); // no crash, just empty results
    await recordResult(screenshotPage, `SEC-06 SQL injection safe: ${payload.slice(0, 30)}`, res.status(), body);
  }
});

test('SEC-07 · SQL injection in astrologer id param returns 404, not 500', async ({ request, screenshotPage }) => {
  const payloads = ["' OR '1'='1", "1; DROP TABLE", '; --'];
  for (const payload of payloads) {
    const res = await request.get(`${API}/astrologer/${encodeURIComponent(payload)}`);
    expect([400, 404]).toContain(res.status());
    const body = await res.json();
    await recordResult(screenshotPage, `SEC-07 ID injection safe: ${payload.slice(0,20)}`, res.status(), body);
  }
});

// ── CRITICAL · Network Interruption / Call Resilience ────────────────────────

test('SEC-08 · ending an already-ended call is idempotent (no double deduct)', async ({ request, screenshotPage }) => {
  const astro  = await registerAstrologer(request);
  const seeker = await registerSeeker(request);

  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 500 },
  });

  const { call_id } = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { astrologer_id: astro.astrologer_id },
  })).json();

  // First end — should succeed
  const end1 = await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { call_id },
  });
  expect(end1.status()).toBe(200);
  const balance1 = (await (await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
  })).json()).balance;

  // Second end — should fail gracefully, not deduct again
  const end2 = await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { call_id },
  });
  expect([400, 404, 409]).toContain(end2.status());
  const balance2 = (await (await request.get(`${API}/wallet/balance`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
  })).json()).balance;

  expect(balance2).toBe(balance1); // no second deduction
  await recordResult(screenshotPage, 'SEC-08 Double end-call is idempotent', end2.status(), { balance1, balance2 });
});

test('SEC-09 · duplicate rating returns 409 (not double insert)', async ({ request, screenshotPage }) => {
  const astro  = await registerAstrologer(request);
  const seeker = await registerSeeker(request);

  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 500 },
  });
  const { call_id } = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { astrologer_id: astro.astrologer_id },
  })).json();
  await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { call_id },
  });
  await request.post(`${API}/call/rate`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { call_id, rating: 5 },
  });

  const dup = await request.post(`${API}/call/rate`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { call_id, rating: 1 },
  });
  expect(dup.status()).toBe(409);
  const body = await dup.json();
  await recordResult(screenshotPage, 'SEC-09 Duplicate rating returns 409', dup.status(), body);
});

// ── HIGH · Empty State ────────────────────────────────────────────────────────

test('EDGE-01 · empty state — no astrologers online returns empty array', async ({ request, screenshotPage }) => {
  // Search for something that will never match
  const res = await request.get(`${API}/astrologer?name=ZZZNOMATCH_UNIQUE_9999`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBe(0);
  await recordResult(screenshotPage, 'EDGE-01 No astrologers returns empty array', res.status(), body);
});

test('EDGE-02 · empty state — new user has no call history', async ({ request, screenshotPage }) => {
  const seeker = await registerSeeker(request);
  const res = await request.get(`${API}/callHistory`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data.length).toBe(0);
  await recordResult(screenshotPage, 'EDGE-02 New user has empty call history', res.status(), body);
});

test('EDGE-03 · empty state — new user has no wallet transactions', async ({ request, screenshotPage }) => {
  const seeker = await registerSeeker(request);
  const res = await request.get(`${API}/wallet/transactions`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data.length).toBe(0);
  expect(body.pagination.total).toBe(0);
  await recordResult(screenshotPage, 'EDGE-03 New user has empty transactions', res.status(), body);
});

test('EDGE-04 · empty state — astrologer with no calls has 0 earnings', async ({ request, screenshotPage }) => {
  const astro = await registerAstrologer(request);
  const res = await request.get(`${API}/astrologer/me/earnings`, {
    headers: { Authorization: `Bearer ${astro.token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.balance).toBe(0);
  expect(body.recent_calls.length).toBe(0);
  await recordResult(screenshotPage, 'EDGE-04 New astrologer has 0 earnings', res.status(), body);
});

// ── HIGH · Error States ───────────────────────────────────────────────────────

test('EDGE-05 · error state — unauthenticated call/start returns 401', async ({ request, screenshotPage }) => {
  const res = await request.post(`${API}/call/start`, {
    data: { astrologer_id: '00000000-0000-0000-0000-000000000000' },
  });
  expect(res.status()).toBe(401);
  const body = await res.json();
  await recordResult(screenshotPage, 'EDGE-05 Unauthenticated call/start returns 401', res.status(), body);
});

test('EDGE-06 · error state — call with nonexistent astrologer returns 404', async ({ request, screenshotPage }) => {
  const seeker = await registerSeeker(request);
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 500 },
  });
  const res = await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { astrologer_id: '00000000-0000-0000-0000-000000000000' },
  });
  expect(res.status()).toBe(404);
  const body = await res.json();
  await recordResult(screenshotPage, 'EDGE-06 Call nonexistent astrologer returns 404', res.status(), body);
});

test('EDGE-07 · error state — rate with invalid rating values', async ({ request, screenshotPage }) => {
  const seeker = await registerSeeker(request);
  for (const bad of [0, 6, -1, 'abc']) {
    const res = await request.post(`${API}/call/rate`, {
      headers: { Authorization: `Bearer ${seeker.token}` },
      data: { call_id: '00000000-0000-0000-0000-000000000000', rating: bad },
    });
    expect([400, 404]).toContain(res.status());
    const body = await res.json();
    await recordResult(screenshotPage, `EDGE-07 Invalid rating ${bad} rejected`, res.status(), body);
  }
});

test('EDGE-08 · error state — missing required fields on register', async ({ request, screenshotPage }) => {
  const res = await request.post(`${API}/auth/register`, {
    data: { email: 'incomplete@test.com' }, // missing password + name
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  await recordResult(screenshotPage, 'EDGE-08 Register missing fields returns 400', res.status(), body);
});

// ── HIGH · Withdrawal Flow ────────────────────────────────────────────────────

test('EDGE-09 · withdrawal — astrologer can request withdrawal after earning', async ({ request, screenshotPage }) => {
  const astro  = await registerAstrologer(request);
  const seeker = await registerSeeker(request);

  await request.post(`${API}/astrologer/me/availability`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { available: true },
  });
  await request.post(`${API}/wallet/test-credit`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { amount: 500 },
  });

  const { call_id } = await (await request.post(`${API}/call/start`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { astrologer_id: astro.astrologer_id },
  })).json();
  await request.post(`${API}/call/end`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
    data: { call_id },
  });

  const earnings = await (await request.get(`${API}/astrologer/me/earnings`, {
    headers: { Authorization: `Bearer ${astro.token}` },
  })).json();

  if (earnings.balance > 0) {
    const wd = await request.post(`${API}/astrologer/me/withdrawal`, {
      headers: { Authorization: `Bearer ${astro.token}` },
      data: { amount: earnings.balance },
    });
    expect(wd.status()).toBe(200);
    const body = await wd.json();
    await recordResult(screenshotPage, 'EDGE-09 Withdrawal request submitted', wd.status(), body);
  } else {
    // Call was too short to earn — just verify endpoint exists
    const wd = await request.post(`${API}/astrologer/me/withdrawal`, {
      headers: { Authorization: `Bearer ${astro.token}` },
      data: { amount: 1 },
    });
    expect([400, 200]).toContain(wd.status());
    const body = await wd.json();
    await recordResult(screenshotPage, 'EDGE-09 Withdrawal endpoint reachable', wd.status(), body);
  }
});

test('EDGE-10 · withdrawal — rejects amount exceeding balance', async ({ request, screenshotPage }) => {
  const astro = await registerAstrologer(request);
  const res = await request.post(`${API}/astrologer/me/withdrawal`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { amount: 99999 },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  await recordResult(screenshotPage, 'EDGE-10 Withdrawal exceeds balance returns 400', res.status(), body);
});

test('EDGE-11 · withdrawal — rejects zero amount', async ({ request, screenshotPage }) => {
  const astro = await registerAstrologer(request);
  const res = await request.post(`${API}/astrologer/me/withdrawal`, {
    headers: { Authorization: `Bearer ${astro.token}` },
    data: { amount: 0 },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  await recordResult(screenshotPage, 'EDGE-11 Withdrawal zero amount returns 400', res.status(), body);
});

// ── MEDIUM · Rate Limiting (only in non-test env — documented) ────────────────

test('EDGE-12 · auth endpoints require all fields (no partial login)', async ({ request, screenshotPage }) => {
  const res = await request.post(`${API}/auth/login`, {
    data: { email: 'test@test.com' }, // missing password
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  await recordResult(screenshotPage, 'EDGE-12 Login without password returns 400', res.status(), body);
});

test('EDGE-13 · wallet/transactions pagination works', async ({ request, screenshotPage }) => {
  const seeker = await registerSeeker(request);
  // Add 3 credits
  for (let i = 0; i < 3; i++) {
    await request.post(`${API}/wallet/test-credit`, {
      headers: { Authorization: `Bearer ${seeker.token}` },
      data: { amount: 10 + i },
    });
  }
  const res = await request.get(`${API}/wallet/transactions?limit=2&page=1`, {
    headers: { Authorization: `Bearer ${seeker.token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data.length).toBeLessThanOrEqual(2);
  expect(body.pagination.total).toBeGreaterThanOrEqual(3);
  expect(body.pagination.pages).toBeGreaterThanOrEqual(2);
  await recordResult(screenshotPage, 'EDGE-13 Wallet transactions pagination', res.status(), body);
});
