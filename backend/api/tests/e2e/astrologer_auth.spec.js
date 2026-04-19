// @ts-check
const { test, expect } = require('@playwright/test');

const API = 'http://localhost:3000';

function astroEmail() {
  return `astro_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
}

async function registerAstrologer(request, overrides = {}) {
  const email = astroEmail();
  const res = await request.post(`${API}/astrologer/auth/register`, {
    data: {
      name: 'Test Astrologer',
      email,
      password: 'password123',
      rate_per_minute: 15,
      ...overrides,
    },
  });
  return { res, email };
}

// ── Registration ──────────────────────────────────────────────────────────────

test('astrologer registration returns token and id', async ({ request }) => {
  const { res } = await registerAstrologer(request);
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.token).toBeTruthy();
  expect(body.astrologer_id).toBeTruthy();
  expect(body.name).toBe('Test Astrologer');
});

test('astrologer registration rejects duplicate email', async ({ request }) => {
  const { email } = await registerAstrologer(request);
  const dup = await request.post(`${API}/astrologer/auth/register`, {
    data: { name: 'Dup', email, password: 'password123' },
  });
  expect(dup.status()).toBe(409);
  const body = await dup.json();
  expect(body.error).toMatch(/already registered/i);
});

test('astrologer registration rejects missing name', async ({ request }) => {
  const res = await request.post(`${API}/astrologer/auth/register`, {
    data: { email: astroEmail(), password: 'password123' },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/name/i);
});

test('astrologer registration rejects short password', async ({ request }) => {
  const res = await request.post(`${API}/astrologer/auth/register`, {
    data: { name: 'X', email: astroEmail(), password: 'short' },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/password/i);
});

test('astrologer registration rejects invalid email', async ({ request }) => {
  const res = await request.post(`${API}/astrologer/auth/register`, {
    data: { name: 'X', email: 'not-an-email', password: 'password123' },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/email/i);
});

// ── Login ─────────────────────────────────────────────────────────────────────

test('astrologer login returns token with role=astrologer', async ({ request }) => {
  const { email } = await registerAstrologer(request);
  const res = await request.post(`${API}/astrologer/auth/login`, {
    data: { email, password: 'password123' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.token).toBeTruthy();
  expect(body.astrologer_id).toBeTruthy();
  expect(body.rate_per_minute).toBe(15);

  // Decode JWT payload (no verify — just inspect claims)
  const payload = JSON.parse(
    Buffer.from(body.token.split('.')[1], 'base64').toString()
  );
  expect(payload.role).toBe('astrologer');
});

test('astrologer login rejects wrong password', async ({ request }) => {
  const { email } = await registerAstrologer(request);
  const res = await request.post(`${API}/astrologer/auth/login`, {
    data: { email, password: 'wrongpassword' },
  });
  expect(res.status()).toBe(401);
  expect((await res.json()).error).toMatch(/invalid credentials/i);
});

test('astrologer login rejects unknown email', async ({ request }) => {
  const res = await request.post(`${API}/astrologer/auth/login`, {
    data: { email: 'nobody@nowhere.com', password: 'password123' },
  });
  expect(res.status()).toBe(401);
});
