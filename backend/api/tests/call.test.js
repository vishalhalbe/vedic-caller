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

  it('returns empty array for new user', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .get('/callHistory')
      .set('Authorization', token);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
