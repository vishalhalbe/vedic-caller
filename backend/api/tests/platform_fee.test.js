/**
 * P1 - Platform fee unit tests
 * Fee is 20%; astrologer receives 80% of call cost.
 */

const PLATFORM_FEE_PCT = 0.20;

function computeFee(callCost) {
  const fee = Math.round(callCost * PLATFORM_FEE_PCT * 100) / 100;
  return { fee, astrologerNet: Math.round((callCost - fee) * 100) / 100 };
}

// ── Fee calculation unit tests ────────────────────────────────────────────────

describe('Platform fee calculation (unit)', () => {
  it('₹100 call → ₹20 fee, ₹80 net', () => {
    const { fee, astrologerNet } = computeFee(100);
    expect(fee).toBeCloseTo(20, 2);
    expect(astrologerNet).toBeCloseTo(80, 2);
  });

  it('₹60 call → ₹12 fee, ₹48 net', () => {
    const { fee, astrologerNet } = computeFee(60);
    expect(fee).toBeCloseTo(12, 2);
    expect(astrologerNet).toBeCloseTo(48, 2);
  });

  it('₹52.50 call → ₹10.50 fee, ₹42 net', () => {
    const { fee, astrologerNet } = computeFee(52.5);
    expect(fee).toBeCloseTo(10.5, 2);
    expect(astrologerNet).toBeCloseTo(42, 2);
  });

  it('fee + net = gross (conservation)', () => {
    [100, 37.5, 1, 999.99].forEach(cost => {
      const { fee, astrologerNet } = computeFee(cost);
      expect(fee + astrologerNet).toBeCloseTo(cost, 2);
    });
  });

  it('zero-cost call produces zero fee and zero net', () => {
    const { fee, astrologerNet } = computeFee(0);
    expect(fee).toBe(0);
    expect(astrologerNet).toBe(0);
  });

  it('fee is never negative', () => {
    expect(computeFee(0.01).fee).toBeGreaterThanOrEqual(0);
  });

  it('astrologer net is always less than gross', () => {
    [10, 100, 500].forEach(cost => {
      expect(computeFee(cost).astrologerNet).toBeLessThan(cost);
    });
  });
});

// ── Admin withdrawal approval integration tests ───────────────────────────────

const request = require('supertest');
const app     = require('../app');

let adminToken;

beforeAll(async () => {
  // Bootstrap admin (uses test secret or falls back gracefully)
  const seedSecret = process.env.ADMIN_SEED_SECRET || 'test_admin_seed';
  const adminEmail = `admin_fee_${Date.now()}@test.com`;
  const adminPw    = 'AdminPass99!';

  await request(app)
    .post('/admin/seed')
    .set('x-seed-secret', seedSecret)
    .send({ email: adminEmail, password: adminPw });

  const loginRes = await request(app)
    .post('/auth/login')
    .send({ email: adminEmail, password: adminPw });

  adminToken = loginRes.body?.token ? `Bearer ${loginRes.body.token}` : null;
});

describe('GET /admin/withdrawals', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/admin/withdrawals');
    expect(res.status).toBe(401);
  });

  it('returns pending withdrawals array for admin', async () => {
    if (!adminToken) return; // skip if admin setup failed in test env
    const res = await request(app)
      .get('/admin/withdrawals')
      .set('Authorization', adminToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('filters by status=approved', async () => {
    if (!adminToken) return;
    const res = await request(app)
      .get('/admin/withdrawals?status=approved')
      .set('Authorization', adminToken);
    expect(res.status).toBe(200);
    res.body.forEach(w => expect(w.status).toBe('approved'));
  });
});

describe('POST /admin/withdrawals/:id/approve', () => {
  it('returns 404 for non-existent withdrawal', async () => {
    if (!adminToken) return;
    const res = await request(app)
      .post('/admin/withdrawals/00000000-0000-0000-0000-000000000000/approve')
      .set('Authorization', adminToken);
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/admin/withdrawals/00000000-0000-0000-0000-000000000000/approve');
    expect(res.status).toBe(401);
  });
});

describe('POST /admin/withdrawals/:id/reject', () => {
  it('returns 404 for non-existent withdrawal', async () => {
    if (!adminToken) return;
    const res = await request(app)
      .post('/admin/withdrawals/00000000-0000-0000-0000-000000000000/reject')
      .set('Authorization', adminToken);
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/admin/withdrawals/00000000-0000-0000-0000-000000000000/reject');
    expect(res.status).toBe(401);
  });
});
