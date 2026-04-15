/**
 * Webhook + payment security tests
 */
const request = require('supertest');
const crypto  = require('crypto');

// Mock Razorpay so create-order tests don't hit the live API
jest.mock('../services/razorpayClient', () => ({
  getRazorpayClient: () => ({
    orders: {
      create: jest.fn().mockResolvedValue({
        id: 'order_test_mock123',
        amount: 10000,
        currency: 'INR',
      }),
    },
  }),
}));

const app = require('../app');

let _seq = 0;
async function registerAndLogin() {
  const email    = `phase1_${Date.now()}${++_seq}@example.com`;
  const password = 'TestPass99';
  await request(app).post('/auth/register').send({ email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return `Bearer ${res.body.token}`;
}

describe('POST /webhook/razorpay', () => {
  it('returns 500 when RAZORPAY_WEBHOOK_SECRET is not set', async () => {
    const saved = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const res = await request(app)
      .post('/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ event: 'payment.captured' }));

    expect(res.status).toBe(500);
    process.env.RAZORPAY_WEBHOOK_SECRET = saved;
  });

  it('returns 400 for invalid signature', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';

    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: {} } },
    });

    const res = await request(app)
      .post('/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'invalidsignature')
      .send(body);

    expect(res.status).toBe(400);
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  it('accepts a valid HMAC-signed webhook', async () => {
    const secret = 'test-webhook-secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;

    const body = JSON.stringify({ event: 'other.event' }); // non-payment — no DB credit
    const sig  = crypto.createHmac('sha256', secret).update(body).digest('hex');

    const res = await request(app)
      .post('/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });
});

describe('POST /payment/success', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/payment/success').send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 when payment fields are missing', async () => {
    const token = await registerAndLogin();
    const res   = await request(app)
      .post('/payment/success')
      .set('Authorization', token)
      .send({ amount: 100 }); // missing order_id, payment_id, signature
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid signature', async () => {
    const token = await registerAndLogin();

    // Create a real order first
    const orderRes = await request(app)
      .post('/payment/create-order')
      .set('Authorization', token)
      .send({ amount: 100 });
    expect(orderRes.status).toBe(200);

    const res = await request(app)
      .post('/payment/success')
      .set('Authorization', token)
      .send({
        order_id:   orderRes.body.order_id,
        payment_id: 'pay_test_fake',
        signature:  'not_a_valid_hmac',
        amount:     100,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/signature/i);
  });
});
