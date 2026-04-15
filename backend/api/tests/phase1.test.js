/**
 * Webhook + payment security tests
 */
const request = require('supertest');
const app = require('../app');
const crypto = require('crypto');

describe('POST /webhook/razorpay', () => {
  it('returns 500 when RAZORPAY_WEBHOOK_SECRET is not set', async () => {
    const savedSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const res = await request(app)
      .post('/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ event: 'payment.captured' }));

    expect(res.status).toBe(500);
    process.env.RAZORPAY_WEBHOOK_SECRET = savedSecret;
  });

  it('returns 400 for invalid signature', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';

    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: {} } } });

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

    const body = JSON.stringify({ event: 'other.event' }); // non-payment event — no DB credit needed
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');

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
    const loginRes = await request(app).post('/auth/login').send({ phone: '9999600001' });
    const token = loginRes.body.token;

    const res = await request(app)
      .post('/payment/success')
      .set('Authorization', token)
      .send({ amount: 100 }); // missing order_id, payment_id, signature

    expect(res.status).toBe(400);
  });
});
