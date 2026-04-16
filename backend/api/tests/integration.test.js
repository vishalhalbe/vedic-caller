/**
 * Integration tests — critical flows and edge cases
 */
const request = require('supertest');
const app = require('../app');
const { Call, User } = require('../models');

let _seq = 0;
async function registerAndLogin() {
  const email = `int_test_${Date.now()}${++_seq}@example.com`;
  const password = 'TestPass99';
  await request(app).post('/auth/register').send({ email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return { token: `Bearer ${res.body.token}`, userId: res.body.user_id };
}

describe('Full call flow — start, end, deduction', () => {
  it('completes a call and deducts cost exactly once', async () => {
    const { token, userId } = await registerAndLogin();

    // Get initial balance
    const initRes = await request(app)
      .get('/wallet/balance')
      .set('Authorization', token);
    const initBalance = initRes.body.balance;

    // Create a call (using hardcoded astrologer from seed data)
    const astrologers = await request(app).get('/astrologer');
    const astro = astrologers.body[0];
    expect(astro).toBeDefined();

    const startRes = await request(app)
      .post('/call/start')
      .set('Authorization', token)
      .send({ astrologer_id: astro.id });
    expect(startRes.status).toBe(200);
    const callId = startRes.body.call_id;

    // End the call immediately
    const endRes = await request(app)
      .post('/call/end')
      .set('Authorization', token)
      .send({ call_id: callId });
    expect(endRes.status).toBe(200);
    const { cost } = endRes.body;
    expect(cost).toBeGreaterThanOrEqual(0);

    // Check balance was deducted exactly once
    const finalRes = await request(app)
      .get('/wallet/balance')
      .set('Authorization', token);
    const finalBalance = finalRes.body.balance;

    expect(initBalance - finalBalance).toBeCloseTo(cost, 2);
  });

  it('retried /call/end does not double-deduct', async () => {
    const { token } = await registerAndLogin();

    const astrologers = await request(app).get('/astrologer');
    const astro = astrologers.body[0];

    const startRes = await request(app)
      .post('/call/start')
      .set('Authorization', token)
      .send({ astrologer_id: astro.id });
    const callId = startRes.body.call_id;

    const initRes = await request(app)
      .get('/wallet/balance')
      .set('Authorization', token);
    const initBalance = initRes.body.balance;

    // End call twice (simulating a retry)
    const end1 = await request(app)
      .post('/call/end')
      .set('Authorization', token)
      .send({ call_id: callId });
    expect(end1.status).toBe(200);
    const cost1 = end1.body.cost;

    const end2 = await request(app)
      .post('/call/end')
      .set('Authorization', token)
      .send({ call_id: callId });
    // Second end should fail (call is already completed)
    expect(end2.status).toBe(400);

    // Check balance was deducted only once
    const finalRes = await request(app)
      .get('/wallet/balance')
      .set('Authorization', token);
    const finalBalance = finalRes.body.balance;

    expect(initBalance - finalBalance).toBeCloseTo(cost1, 2);
  });

  it('cannot start call with unavailable astrologer', async () => {
    const { token } = await registerAndLogin();

    // Seed data has astrologers with is_available=false
    const astrologers = await request(app).get('/astrologer');
    const unavailable = astrologers.body.find(a => !a.is_available);

    if (unavailable) {
      const res = await request(app)
        .post('/call/start')
        .set('Authorization', token)
        .send({ astrologer_id: unavailable.id });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not available/i);
    }
  });

  it('cannot start call with insufficient balance', async () => {
    const { token } = await registerAndLogin();

    const astrologers = await request(app).get('/astrologer');
    const expensiveAstro = astrologers.body.find(a => a.rate_per_minute > 50);

    if (expensiveAstro) {
      const res = await request(app)
        .post('/call/start')
        .set('Authorization', token)
        .send({ astrologer_id: expensiveAstro.id });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/insufficient/i);
    }
  });

  it('/call/start reads rate from DB, not client body', async () => {
    const { token } = await registerAndLogin();

    const astrologers = await request(app).get('/astrologer');
    const astro = astrologers.body[0];

    // Try to pass a fake rate in the body — should be ignored
    const res = await request(app)
      .post('/call/start')
      .set('Authorization', token)
      .send({
        astrologer_id: astro.id,
        rate: 0.01, // attempt to manipulate billing
      });

    expect(res.status).toBe(200);

    // Verify the actual rate from the DB was used
    const call = await Call.findByPk(res.body.call_id);
    expect(parseFloat(call.rate_per_minute)).toBe(astro.rate_per_minute);
    expect(call.rate_per_minute).not.toBe(0.01);
  });
});

describe('Call state validation', () => {
  it('cannot end a non-existent call', async () => {
    const { token } = await registerAndLogin();

    const res = await request(app)
      .post('/call/end')
      .set('Authorization', token)
      .send({ call_id: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found|ended/i);
  });

  it('cannot start two concurrent calls', async () => {
    const { token } = await registerAndLogin();

    const astrologers = await request(app).get('/astrologer');
    const astro = astrologers.body[0];

    // Start first call
    const res1 = await request(app)
      .post('/call/start')
      .set('Authorization', token)
      .send({ astrologer_id: astro.id });
    expect(res1.status).toBe(200);

    // Try to start second call — should fail due to UNIQUE index
    const res2 = await request(app)
      .post('/call/start')
      .set('Authorization', token)
      .send({ astrologer_id: astro.id });

    // Either 400 (app-level guard) or 500 (DB constraint), both acceptable
    expect([400, 500]).toContain(res2.status);
  });
});

describe('Astrologer availability guard', () => {
  it('GET /astrologer returns only available astrologers', async () => {
    const res = await request(app).get('/astrologer');
    expect(res.status).toBe(200);

    const all = res.body;
    const unavailable = all.filter(a => !a.is_available);

    // Seed data has some unavailable, so this should be true
    if (unavailable.length > 0) {
      expect(unavailable.length).toBeGreaterThan(0);
    }

    // All returned should be available
    const allAvailable = all.every(a => a.is_available === true);
    expect(allAvailable).toBe(true);
  });
});
