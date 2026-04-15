const { test, expect } = require('@playwright/test');
const { register, auth, topUpWallet } = require('./helpers');

// Seed astrologer UUID — must exist in the DB (from migration seed data)
const ASTROLOGER_ID = process.env.TEST_ASTROLOGER_ID || null;
const RATE = 60; // ₹60/min

test.describe('Call Flow', () => {
  test.beforeAll(async ({ request }) => {
    if (!ASTROLOGER_ID) {
      // Try to discover an astrologer from the list endpoint
      const res = await request.get('/astrologer');
      if (res.ok()) {
        const list = await res.json();
        if (list.length > 0) {
          process.env.TEST_ASTROLOGER_ID = list[0].id;
        }
      }
    }
  });

  test('GET /astrologer returns array of available astrologers', async ({ request }) => {
    const { token } = await register(request);
    const res = await request.get('/astrologer', auth(token));
    expect(res.status()).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
  });

  test('POST /call/start requires auth', async ({ request }) => {
    const res = await request.post('/call/start', {
      data: { astrologer_id: 'some-id', rate: RATE },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /call/start requires astrologer_id and rate', async ({ request }) => {
    const { token } = await register(request);
    const res = await request.post('/call/start', {
      data: {},
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /call/start blocked when balance is zero', async ({ request }) => {
    const { token } = await register(request);
    const astrologerId = process.env.TEST_ASTROLOGER_ID;
    if (!astrologerId) { test.skip(); return; }

    const res = await request.post('/call/start', {
      data: { astrologer_id: astrologerId, rate: RATE },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/insufficient/i);
  });

  test('full call cycle: start → end → billing deducted → history updated', async ({ request }) => {
    const astrologerId = process.env.TEST_ASTROLOGER_ID;
    if (!astrologerId) { test.skip(); return; }

    const { token } = await register(request);
    // Top up ₹500
    await topUpWallet(request, token, 500);

    // Start call
    const startRes = await request.post('/call/start', {
      data: { astrologer_id: astrologerId, rate: RATE },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(startRes.status()).toBe(200);
    const startBody = await startRes.json();
    expect(startBody.call_id).toBeTruthy();
    expect(startBody.channel).toBeTruthy();
    const callId = startBody.call_id;

    // End call after simulated 60 seconds
    const durationSeconds = 60;
    const endRes = await request.post('/call/end', {
      data: { call_id: callId, rate: RATE, duration_seconds: durationSeconds },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(endRes.status()).toBe(200);

    // cost = (60/60) * 60 = ₹60
    const expectedCost = parseFloat(((RATE / 60) * durationSeconds).toFixed(2));

    // Verify balance
    const balRes = await request.get('/wallet/balance', auth(token));
    const { balance } = await balRes.json();
    expect(balance).toBeCloseTo(500 - expectedCost, 1);

    // Verify history
    const histRes = await request.get('/callHistory', auth(token));
    expect(histRes.status()).toBe(200);
    const history = await histRes.json();
    expect(history.length).toBeGreaterThan(0);
    const latest = history[0];
    expect(latest.duration_seconds).toBe(durationSeconds);
    expect(parseFloat(latest.cost)).toBeCloseTo(expectedCost, 1);
    expect(latest.status).toBe('completed');
  });

  test('call billing rounds to 2 decimal places', async ({ request }) => {
    const astrologerId = process.env.TEST_ASTROLOGER_ID;
    if (!astrologerId) { test.skip(); return; }

    const { token } = await register(request);
    await topUpWallet(request, token, 500);

    const startRes = await request.post('/call/start', {
      data: { astrologer_id: astrologerId, rate: 35 },
      headers: { Authorization: `Bearer ${token}` },
    });
    const { call_id } = await startRes.json();

    // 90 seconds @ ₹35/min = ₹52.50
    const endRes = await request.post('/call/end', {
      data: { call_id, rate: 35, duration_seconds: 90 },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(endRes.status()).toBe(200);

    const { balance } = await (await request.get('/wallet/balance', auth(token))).json();
    expect(balance).toBeCloseTo(500 - 52.5, 1);
  });
});
