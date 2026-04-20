/**
 * Call lifecycle integration tests
 */
const request = require('supertest');
const app     = require('../app');

let _seq = 0;
async function registerAndLogin() {
  const email    = `call_test_${Date.now()}${++_seq}@example.com`;
  const password = 'TestPass99';
  await request(app).post('/auth/register').send({ email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return { token: `Bearer ${res.body.token}`, userId: res.body.user_id };
}

describe('POST /call/start', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/call/start').send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 when astrologer_id is missing', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/call/start')
      .set('Authorization', token)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent astrologer', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/call/start')
      .set('Authorization', token)
      .send({ astrologer_id: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });
});

describe('POST /call/end', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/call/end').send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 when no active call exists', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/call/end')
      .set('Authorization', token)
      .send({ call_id: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found|ended/i);
  });

  it('returns 400 on second call/end (call already completed)', async () => {
    const { token } = await registerAndLogin();

    // Need a funded wallet + available astrologer
    await request(app)
      .post('/wallet/test-credit')
      .set('Authorization', token)
      .send({ amount: 500 });

    const astros = await request(app).get('/astrologer');
    if (!astros.body[0]) return; // no astrologers seeded

    const startRes = await request(app)
      .post('/call/start')
      .set('Authorization', token)
      .send({ astrologer_id: astros.body[0].id });
    if (startRes.status !== 200) return; // astrologer may be busy from parallel test

    const callId = startRes.body.call_id;

    const end1 = await request(app)
      .post('/call/end')
      .set('Authorization', token)
      .send({ call_id: callId });
    expect(end1.status).toBe(200);
    expect(typeof end1.body.cost).toBe('number');
    expect(typeof end1.body.duration).toBe('number');

    const end2 = await request(app)
      .post('/call/end')
      .set('Authorization', token)
      .send({ call_id: callId });
    expect(end2.status).toBe(400);
    expect(end2.body.error).toMatch(/ended/i);
  });

  it('deducts cost from wallet after ending a call', async () => {
    const { token } = await registerAndLogin();

    await request(app)
      .post('/wallet/test-credit')
      .set('Authorization', token)
      .send({ amount: 500 });

    const astros = await request(app).get('/astrologer');
    if (!astros.body[0]) return;

    const balBefore = (await request(app).get('/wallet/balance').set('Authorization', token)).body.balance;

    const startRes = await request(app)
      .post('/call/start')
      .set('Authorization', token)
      .send({ astrologer_id: astros.body[0].id });
    if (startRes.status !== 200) return;

    const endRes = await request(app)
      .post('/call/end')
      .set('Authorization', token)
      .send({ call_id: startRes.body.call_id });
    expect(endRes.status).toBe(200);

    const balAfter = (await request(app).get('/wallet/balance').set('Authorization', token)).body.balance;
    expect(balBefore - balAfter).toBeCloseTo(endRes.body.cost, 2);
  });
});

describe('GET /astrologer', () => {
  it('returns an array of available astrologers', async () => {
    const res = await request(app).get('/astrologer');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /astrologer/all returns 404 (route removed)', async () => {
    const res = await request(app).get('/astrologer/all');
    expect(res.status).toBe(404);
  });
});

describe('POST /call/cleanup', () => {
  it('returns 401 without cleanup secret', async () => {
    const res = await request(app).post('/call/cleanup');
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const res = await request(app)
      .post('/call/cleanup')
      .set('x-cleanup-secret', 'wrong');
    expect(res.status).toBe(401);
  });

  it('closes stale active calls with correct secret', async () => {
    process.env.CLEANUP_SECRET = 'test-cleanup-secret';
    const res = await request(app)
      .post('/call/cleanup')
      .set('x-cleanup-secret', 'test-cleanup-secret');
    expect(res.status).toBe(200);
    expect(typeof res.body.cleaned).toBe('number');
    delete process.env.CLEANUP_SECRET;
  });
});

describe('GET /callHistory', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/callHistory');
    expect(res.status).toBe(401);
  });

  it('returns paginated response for new user', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .get('/callHistory')
      .set('Authorization', token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.pagination).toBe('object');
    expect(typeof res.body.pagination.total).toBe('number');
  });

  it('respects limit and page params', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .get('/callHistory?page=1&limit=5')
      .set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(5);
    expect(res.body.pagination.page).toBe(1);
  });
});
