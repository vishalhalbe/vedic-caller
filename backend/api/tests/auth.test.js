/**
 * Auth integration tests — email/password login
 * Run: DB_URI=postgres://... JWT_SECRET=testsecret NODE_ENV=test npm test
 */
const request = require('supertest');
const app     = require('../app');

// Helper — unique email per test run to avoid conflicts
let _seq = 0;
function uniqueEmail() { return `test${Date.now()}${++_seq}@example.com`; }

describe('POST /auth/register', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/auth/register').send({ password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('returns 400 when email is invalid', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'notanemail', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app).post('/auth/register').send({ email: uniqueEmail(), password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('creates account and returns a JWT', async () => {
    const res = await request(app).post('/auth/register').send({
      email: uniqueEmail(),
      password: 'Password123',
      name: 'Test User',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.token.split('.').length).toBe(3);
    expect(res.body.user_id).toBeDefined();
  });

  it('returns 409 on duplicate email', async () => {
    const email = uniqueEmail();
    await request(app).post('/auth/register').send({ email, password: 'Password123' });
    const res = await request(app).post('/auth/register').send({ email, password: 'Password123' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already registered/i);
  });
});

describe('POST /auth/login', () => {
  const email    = `login_test_${Date.now()}@example.com`;
  const password = 'LoginPass99';

  beforeAll(async () => {
    await request(app).post('/auth/register').send({ email, password });
  });

  it('returns 400 when credentials are missing', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/auth/login').send({ email, password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'nobody@example.com', password });
    expect(res.status).toBe(401);
  });

  it('returns a valid JWT for correct credentials', async () => {
    const res = await request(app).post('/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.token.split('.').length).toBe(3);
  });

  it('login is case-insensitive for email', async () => {
    const res = await request(app).post('/auth/login').send({
      email: email.toUpperCase(),
      password,
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

describe('Auth rate limiting', () => {
  it('returns 429 after 10 failed login attempts', async () => {
    // Use a unique X-Forwarded-For IP so this test doesn't pollute other tests
    const fakeIp = `10.99.${Date.now() % 255}.1`;
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/auth/login')
        .set('X-Forwarded-For', fakeIp)
        .send({ email: 'nobody@example.com', password: 'wrong' });
    }
    const res = await request(app)
      .post('/auth/login')
      .set('X-Forwarded-For', fakeIp)
      .send({ email: 'nobody@example.com', password: 'wrong' });
    expect(res.status).toBe(429);
  });
});

describe('POST /auth/logout', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const email    = `logout_test_${Date.now()}@example.com`;
    const password = 'LogoutPass99';
    await request(app).post('/auth/register').send({ email, password });
    const loginRes = await request(app).post('/auth/login').send({ email, password });
    const token = `Bearer ${loginRes.body.token}`;
    const res = await request(app).post('/auth/logout').set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Refresh token (TASK-11)', () => {
  let accessToken, refreshToken;

  beforeAll(async () => {
    const email = `refresh_test_${Date.now()}@example.com`;
    const res = await request(app).post('/auth/register').send({ email, password: 'RefreshPass99' });
    accessToken  = res.body.token;
    refreshToken = res.body.refresh_token;
  });

  it('login returns both token and refresh_token', () => {
    expect(accessToken).toBeDefined();
    expect(accessToken.split('.').length).toBe(3); // JWT structure
    expect(refreshToken).toBeDefined();
    expect(typeof refreshToken).toBe('string');
    expect(refreshToken.length).toBe(64); // 32 bytes hex
  });

  it('POST /auth/refresh issues new access token', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
    // New tokens must differ from the originals (rotation)
    expect(res.body.token).not.toBe(accessToken);
    expect(res.body.refresh_token).not.toBe(refreshToken);
    // Update for next test
    refreshToken = res.body.refresh_token;
  });

  it('used refresh token is revoked — cannot reuse', async () => {
    // Save current refresh token, then refresh to rotate it
    const used = refreshToken;
    const rotateRes = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: used });
    expect(rotateRes.status).toBe(200);
    refreshToken = rotateRes.body.refresh_token;

    // The 'used' token is now revoked
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: used });
    expect(res.status).toBe(401);
  });

  it('invalid refresh token returns 401', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: 'a'.repeat(64) });
    expect(res.status).toBe(401);
  });

  it('missing refresh_token body returns 400', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/refresh_token required/i);
  });

  it('logout with refresh_token revokes it', async () => {
    const tokenBearer = `Bearer ${accessToken}`;
    await request(app)
      .post('/auth/logout')
      .set('Authorization', tokenBearer)
      .send({ refresh_token: refreshToken });

    // Token should now be revoked
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken });
    expect(res.status).toBe(401);
  });
});
