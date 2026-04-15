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
      .send({ rate: 60 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when rate is missing', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/call/start')
      .set('Authorization', token)
      .send({ astrologer_id: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for insufficient balance (new user has ₹0)', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/call/start')
      .set('Authorization', token)
      .send({ astrologer_id: '00000000-0000-0000-0000-000000000000', rate: 60 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient/i);
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
