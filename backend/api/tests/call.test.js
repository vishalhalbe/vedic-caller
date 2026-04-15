/**
 * Call lifecycle integration tests
 */
const request = require('supertest');
const app = require('../app');

async function loginAndGetToken(phone) {
  const res = await request(app).post('/auth/login').send({ phone });
  return { token: res.body.token, userId: res.body.user_id };
}

describe('POST /call/start', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/call/start').send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 when astrologer_id or rate is missing', async () => {
    const { token } = await loginAndGetToken('9999700001');
    const res = await request(app)
      .post('/call/start')
      .set('Authorization', token)
      .send({ rate: 60 }); // missing astrologer_id

    expect(res.status).toBe(400);
  });
});

describe('POST /call/end', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/call/end').send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 when rate is missing', async () => {
    const { token } = await loginAndGetToken('9999700002');
    const res = await request(app)
      .post('/call/end')
      .set('Authorization', token)
      .send({}); // no rate

    expect(res.status).toBe(400);
  });

  it('returns 400 when no active call exists', async () => {
    const { token } = await loginAndGetToken('9999700003');
    const res = await request(app)
      .post('/call/end')
      .set('Authorization', token)
      .send({ rate: 60, call_id: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(400);
  });
});

describe('GET /astrologer', () => {
  it('returns an array of astrologers', async () => {
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

  it('returns call history array for authenticated user', async () => {
    const { token } = await loginAndGetToken('9999700004');
    const res = await request(app)
      .get('/callHistory')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
