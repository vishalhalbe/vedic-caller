/**
 * Billing formula unit tests + wallet integration tests
 */
const { calculateDeduction } = require('../services/walletService');
const { runBilling } = require('../services/billingEngine');

// ── Formula unit tests ────────────────────────────────────────────────────────

describe('calculateDeduction (unit)', () => {
  it('60 sec at ₹60/min = ₹60', () => {
    expect(calculateDeduction(60, 60)).toBeCloseTo(60, 5);
  });

  it('30 sec at ₹60/min = ₹30', () => {
    expect(calculateDeduction(60, 30)).toBeCloseTo(30, 5);
  });

  it('1 sec at ₹60/min = ₹1', () => {
    expect(calculateDeduction(60, 1)).toBeCloseTo(1, 5);
  });

  it('90 sec at ₹35/min ≈ ₹52.50', () => {
    expect(calculateDeduction(35, 90)).toBeCloseTo(52.5, 2);
  });

  it('zero seconds = zero cost', () => {
    expect(calculateDeduction(100, 0)).toBe(0);
  });
});

describe('runBilling (unit)', () => {
  it('accumulated 60s billing matches single calculation', () => {
    const accumulated = runBilling(60, 60);
    const direct = calculateDeduction(60, 60);
    expect(accumulated).toBeCloseTo(direct, 2);
  });
});

// ── Wallet API integration tests ──────────────────────────────────────────────

const request = require('supertest');
const app = require('../app');

async function loginAndGetToken(phone) {
  const res = await request(app).post('/auth/login').send({ phone });
  return { token: res.body.token, userId: res.body.user_id };
}

describe('GET /wallet/balance', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/wallet/balance');
    expect(res.status).toBe(401);
  });

  it('returns balance for authenticated user', async () => {
    const { token } = await loginAndGetToken('9999800001');
    const res = await request(app)
      .get('/wallet/balance')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(typeof res.body.balance).toBe('number');
  });
});

describe('POST /wallet/deduct', () => {
  it('returns 400 for invalid amount', async () => {
    const { token } = await loginAndGetToken('9999800002');
    const res = await request(app)
      .post('/wallet/deduct')
      .set('Authorization', token)
      .send({ amount: -10 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when balance is insufficient', async () => {
    const { token } = await loginAndGetToken('9999800003');
    const res = await request(app)
      .post('/wallet/deduct')
      .set('Authorization', token)
      .send({ amount: 999999 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Insufficient balance');
  });
});

describe('Idempotency', () => {
  it('returns same response for duplicate Idempotency-Key', async () => {
    const { token } = await loginAndGetToken('9999800004');
    const key = `test-idem-${Date.now()}`;

    const first = await request(app)
      .get('/wallet/balance')
      .set('Authorization', token)
      .set('Idempotency-Key', key);

    const second = await request(app)
      .get('/wallet/balance')
      .set('Authorization', token)
      .set('Idempotency-Key', key);

    expect(first.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });
});
