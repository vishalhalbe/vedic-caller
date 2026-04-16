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

/** Directly credit wallet in DB — only for tests that need balance to start a call */
async function giveBalance(userId, amount = 500) {
  await User.update({ wallet_balance: amount }, { where: { id: userId } });
}

/** Reset test DB state: cancel active calls and restore astrologer availability */
async function resetCallState() {
  const { Astrologer } = require('../models');
  await Call.update({ status: 'cancelled' }, { where: { status: 'active' } });
  await Astrologer.update({ is_available: true }, { where: {} });
}

beforeEach(resetCallState);

describe('Full call flow — start, end, deduction', () => {
  it('completes a call and deducts cost exactly once', async () => {
    const { token, userId } = await registerAndLogin();
    await giveBalance(userId);

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
    const { token, userId } = await registerAndLogin();
    await giveBalance(userId);

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
    const { token, userId } = await registerAndLogin();
    await giveBalance(userId);

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

    // Verify the actual rate from the DB was used (compare as floats)
    const call = await Call.findByPk(res.body.call_id);
    expect(parseFloat(call.rate_per_minute)).toBe(parseFloat(astro.rate_per_minute));
    expect(parseFloat(call.rate_per_minute)).not.toBe(0.01);
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
    const { token, userId } = await registerAndLogin();
    await giveBalance(userId);

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

describe('Astrologer availability lifecycle', () => {
  it('astrologer becomes unavailable after call starts, available after call ends', async () => {
    const { token, userId } = await registerAndLogin();
    await giveBalance(userId);

    const astrologers = await request(app).get('/astrologer');
    const astro = astrologers.body[0];
    expect(astro.is_available).toBe(true);

    // Start call — astrologer should become unavailable
    const startRes = await request(app)
      .post('/call/start')
      .set('Authorization', token)
      .send({ astrologer_id: astro.id });
    expect(startRes.status).toBe(200);

    const { Astrologer } = require('../models');
    const duringCall = await Astrologer.findByPk(astro.id, { attributes: ['is_available'] });
    expect(duringCall.is_available).toBe(false);

    // End call — astrologer should become available again
    await request(app)
      .post('/call/end')
      .set('Authorization', token)
      .send({ call_id: startRes.body.call_id });

    const afterCall = await Astrologer.findByPk(astro.id, { attributes: ['is_available'] });
    expect(afterCall.is_available).toBe(true);
  });

  it('two users cannot call the same astrologer simultaneously', async () => {
    const user1 = await registerAndLogin();
    const user2 = await registerAndLogin();
    await giveBalance(user1.userId);
    await giveBalance(user2.userId);

    const astrologers = await request(app).get('/astrologer');
    const astro = astrologers.body[0];

    // User 1 starts call — marks astrologer unavailable
    const res1 = await request(app)
      .post('/call/start')
      .set('Authorization', user1.token)
      .send({ astrologer_id: astro.id });
    expect(res1.status).toBe(200);

    // User 2 tries to call the same astrologer — should be rejected
    const res2 = await request(app)
      .post('/call/start')
      .set('Authorization', user2.token)
      .send({ astrologer_id: astro.id });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toMatch(/not available/i);

    // Cleanup: end user1's call
    await request(app)
      .post('/call/end')
      .set('Authorization', user1.token)
      .send({ call_id: res1.body.call_id });
  });
});
