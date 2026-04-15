/**
 * Auth integration tests
 * Run against a test DB: DB_URI=postgres://... NODE_ENV=test JWT_SECRET=testsecret npm test
 */
const request = require('supertest');
const app = require('../app');

describe('POST /auth/login', () => {
  it('returns 400 when phone is missing', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns a JWT token for a valid phone number', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ phone: '9999900001' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.split('.').length).toBe(3); // valid JWT structure
  });

  it('returns the same user on repeated login with the same phone', async () => {
    const phone = '9999900002';
    const first  = await request(app).post('/auth/login').send({ phone });
    const second = await request(app).post('/auth/login').send({ phone });

    expect(first.body.user_id).toBe(second.body.user_id);
  });
});
