/**
 * Integration tests — critical flows and edge cases
 */
const request  = require('supertest');
const app      = require('../app');
const supabase = require('../config/db');

let _seq = 0;
async function registerAndLogin() {
  const email = `int_test_${Date.now()}${++_seq}@example.com`;
  const password = 'TestPass99';
  await request(app).post('/auth/register').send({ email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return { token: `Bearer ${res.body.token}`, userId: res.body.user_id };
}

async function giveBalance(userId, amount = 500) {
  await supabase.from('users').update({ wallet_balance: amount }).eq('id', userId);
}

async function resetCallState() {
  await supabase.from('calls').update({ status: 'cancelled' }).eq('status', 'active');
  await supabase.from('astrologers').update({ is_available: true }).neq('id', '00000000-0000-0000-0000-000000000000');
}

async function getAvailableAstrologer() {
  const res = await request(app).get('/astrologer');
  return res.body[0];
}

beforeEach(resetCallState);

describe('Full call flow — start, end, deduction', () => {
  it('completes a call and deducts cost exactly once', async () => {
    const { token, userId } = await registerAndLogin();
    await giveBalance(userId);

    const initRes = await request(app).get('/wallet/balance').set('Authorization', token);
    const initBalance = initRes.body.balance;

    const astro = await getAvailableAstrologer();
    expect(astro).toBeDefined();

    const startRes = await request(app)
      .post('/call/start').set('Authorization', token)
      .send({ astrologer_id: astro.id });
    expect(startRes.status).toBe(200);
    const callId = startRes.body.call_id;

    const endRes = await request(app)
      .post('/call/end').set('Authorization', token)
      .send({ call_id: callId });
    expect(endRes.status).toBe(200);
    const { cost } = endRes.body;
    expect(cost).toBeGreaterThanOrEqual(0);

    const finalRes = await request(app).get('/wallet/balance').set('Authorization', token);
    expect(initBalance - finalRes.body.balance).toBeCloseTo(cost, 2);
  });

  it('retried /call/end does not double-deduct', async () => {
    const { token, userId } = await registerAndLogin();
    await giveBalance(userId);

    const astro = await getAvailableAstrologer();
    const startRes = await request(app)
      .post('/call/start').set('Authorization', token)
      .send({ astrologer_id: astro.id });
    const callId = startRes.body.call_id;

    const initBalance = (await request(app).get('/wallet/balance').set('Authorization', token)).body.balance;

    const end1 = await request(app)
      .post('/call/end').set('Authorization', token)
      .send({ call_id: callId });
    expect(end1.status).toBe(200);
    const cost1 = end1.body.cost;

    const end2 = await request(app)
      .post('/call/end').set('Authorization', token)
      .send({ call_id: callId });
    expect(end2.status).toBe(400);

    const finalBalance = (await request(app).get('/wallet/balance').set('Authorization', token)).body.balance;
    expect(initBalance - finalBalance).toBeCloseTo(cost1, 2);
  });

  it('cannot start call with unavailable astrologer', async () => {
    const { token } = await registerAndLogin();

    const astro = await getAvailableAstrologer();
    if (!astro) return;
    await supabase.from('astrologers').update({ is_available: false }).eq('id', astro.id);

    const res = await request(app)
      .post('/call/start').set('Authorization', token)
      .send({ astrologer_id: astro.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not available/i);
  });

  it('cannot start call with insufficient balance', async () => {
    const { token } = await registerAndLogin();
    // balance = 0 after register

    const astro = await getAvailableAstrologer();
    if (!astro) return;

    const res = await request(app)
      .post('/call/start').set('Authorization', token)
      .send({ astrologer_id: astro.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient/i);
  });

  it('/call/start reads rate from DB, not client body', async () => {
    const { token, userId } = await registerAndLogin();
    await giveBalance(userId);

    const astro = await getAvailableAstrologer();
    const res = await request(app)
      .post('/call/start').set('Authorization', token)
      .send({ astrologer_id: astro.id, rate: 0.01 });
    expect(res.status).toBe(200);

    const { data: call } = await supabase
      .from('calls').select('rate_per_minute').eq('id', res.body.call_id).single();
    expect(parseFloat(call.rate_per_minute)).not.toBe(0.01);
    expect(parseFloat(call.rate_per_minute)).toBe(parseFloat(astro.rate_per_minute));
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

    const astro = await getAvailableAstrologer();

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
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every(a => a.is_available === true)).toBe(true);
  });
});

describe('Astrologer availability lifecycle', () => {
  it('astrologer becomes unavailable after call starts, available after call ends', async () => {
    const { token, userId } = await registerAndLogin();
    await giveBalance(userId);

    const astro = await getAvailableAstrologer();
    expect(astro.is_available).toBe(true);

    const startRes = await request(app)
      .post('/call/start').set('Authorization', token)
      .send({ astrologer_id: astro.id });
    expect(startRes.status).toBe(200);

    const { data: duringCall } = await supabase
      .from('astrologers').select('is_available').eq('id', astro.id).single();
    expect(duringCall.is_available).toBe(false);

    await request(app)
      .post('/call/end').set('Authorization', token)
      .send({ call_id: startRes.body.call_id });

    const { data: afterCall } = await supabase
      .from('astrologers').select('is_available').eq('id', astro.id).single();
    expect(afterCall.is_available).toBe(true);
  });

  it('two users cannot call the same astrologer simultaneously', async () => {
    const user1 = await registerAndLogin();
    const user2 = await registerAndLogin();
    await giveBalance(user1.userId);
    await giveBalance(user2.userId);

    const astro = await getAvailableAstrologer();

    const res1 = await request(app)
      .post('/call/start').set('Authorization', user1.token)
      .send({ astrologer_id: astro.id });
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post('/call/start').set('Authorization', user2.token)
      .send({ astrologer_id: astro.id });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toMatch(/not available/i);

    await request(app)
      .post('/call/end').set('Authorization', user1.token)
      .send({ call_id: res1.body.call_id });
  });
});
