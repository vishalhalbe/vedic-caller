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
