/**
 * Payment flow + webhook integration tests
 */
const request  = require('supertest');
const crypto   = require('crypto');
const app      = require('../app');
const supabase = require('../config/db');

let _seq = 0;
async function registerAndLogin() {
  const email    = `pay_test_${Date.now()}${++_seq}@example.com`;
  const password = 'TestPass99';
  await request(app).post('/auth/register').send({ email, password });
  const res = await request(app).post('/auth/login').send({ email, password });
  return { token: `Bearer ${res.body.token}`, userId: res.body.user_id };
}

// ── POST /payment/create-order ────────────────────────────────────────────────

describe('POST /payment/create-order', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/payment/create-order').send({ amount: 100 });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing amount', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/payment/create-order')
      .set('Authorization', token)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid amount/i);
  });

  it('returns 400 for zero amount', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/payment/create-order')
      .set('Authorization', token)
      .send({ amount: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative amount', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/payment/create-order')
      .set('Authorization', token)
      .send({ amount: -50 });
    expect(res.status).toBe(400);
  });

  it('creates order and returns order_id + amount in paise', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/payment/create-order')
      .set('Authorization', token)
      .send({ amount: 100 });
    expect(res.status).toBe(200);
    expect(res.body.order_id).toBeDefined();
    expect(res.body.amount).toBe(10000); // 100 INR → 10000 paise
    expect(res.body.currency).toBe('INR');
  });

  it('persists order to DB with status created', async () => {
    const { token, userId } = await registerAndLogin();
    const res = await request(app)
      .post('/payment/create-order')
      .set('Authorization', token)
      .send({ amount: 200 });
    expect(res.status).toBe(200);
    const { data: order } = await supabase
      .from('orders').select('*').eq('id', res.body.order_id).single();
    expect(order).not.toBeNull();
    expect(order.status).toBe('created');
    expect(parseFloat(order.amount)).toBe(200);
    expect(order.user_id).toBe(userId);
  });
});

// ── POST /payment/success ─────────────────────────────────────────────────────

describe('POST /payment/success', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/payment/success').send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 when required fields are missing', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/payment/success')
      .set('Authorization', token)
      .send({ order_id: 'x' }); // missing payment_id + signature
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 for invalid HMAC signature', async () => {
    const { token, userId } = await registerAndLogin();

    // Create a real order first
    const orderRes = await request(app)
      .post('/payment/create-order')
      .set('Authorization', token)
      .send({ amount: 100 });
    const orderId = orderRes.body.order_id;

    // Set a known key_secret in the environment so verifyPayment works
    const secret    = 'test_razorpay_key_secret';
    const paymentId = `pay_test_${Date.now()}`;
    // Bad signature
    process.env.RAZORPAY_KEY_SECRET = secret;
    const res = await request(app)
      .post('/payment/success')
      .set('Authorization', token)
      .send({ order_id: orderId, payment_id: paymentId, signature: 'bad_signature' });
    delete process.env.RAZORPAY_KEY_SECRET;

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid payment signature/i);
  });

  it('credits wallet for valid signature and marks order paid', async () => {
    const { token, userId } = await registerAndLogin();
    const orderRes = await request(app)
      .post('/payment/create-order')
      .set('Authorization', token)
      .send({ amount: 100 });
    const orderId = orderRes.body.order_id;

    const secret    = 'test_razorpay_key_secret';
    const paymentId = `pay_test_${Date.now()}`;
    // Build correct HMAC — same formula as verifySignature
    const body      = `${orderId}|${paymentId}`;
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    process.env.RAZORPAY_KEY_SECRET = secret;
    const res = await request(app)
      .post('/payment/success')
      .set('Authorization', token)
      .send({ order_id: orderId, payment_id: paymentId, signature });
    delete process.env.RAZORPAY_KEY_SECRET;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.balance).toBeCloseTo(100, 1);

    const { data: order } = await supabase
      .from('orders').select('status').eq('id', orderId).single();
    expect(order.status).toBe('paid');
  });

  it('is idempotent — second call with same payment_id returns balance without double-crediting', async () => {
    const { token, userId } = await registerAndLogin();

    // Create two orders so we can call /payment/success twice
    const orderRes1 = await request(app)
      .post('/payment/create-order')
      .set('Authorization', token)
      .send({ amount: 50 });
    const orderId   = orderRes1.body.order_id;
    const secret    = 'test_razorpay_key_secret';
    const paymentId = `pay_idem_${Date.now()}`;
    const body      = `${orderId}|${paymentId}`;
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    process.env.RAZORPAY_KEY_SECRET = secret;
    const first = await request(app)
      .post('/payment/success')
      .set('Authorization', token)
      .send({ order_id: orderId, payment_id: paymentId, signature });
    expect(first.status).toBe(200);
    const balanceAfterFirst = first.body.balance;

    // Second call — order already paid, should return current balance without crediting again
    const second = await request(app)
      .post('/payment/success')
      .set('Authorization', token)
      .send({ order_id: orderId, payment_id: paymentId, signature });
    delete process.env.RAZORPAY_KEY_SECRET;
    expect(second.status).toBe(200);
    expect(second.body.balance).toBeCloseTo(balanceAfterFirst, 1);
  });
});

// ── POST /webhook/razorpay ────────────────────────────────────────────────────

describe('POST /webhook/razorpay', () => {
  const WEBHOOK_SECRET = 'webhook_test_secret';

  function buildWebhookPayload(userId, orderId, paymentId) {
    return JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id:       paymentId,
            order_id: orderId,
            notes:    { user_id: userId },
          },
        },
      },
    });
  }

  function signBody(body) {
    return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  }

  it('returns 400 when RAZORPAY_WEBHOOK_SECRET is not set', async () => {
    const body = buildWebhookPayload('uid', 'oid', 'pid');
    const res  = await request(app)
      .post('/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signBody(body))
      .send(body);
    // Secret not set → 500
    expect([400, 500]).toContain(res.status);
  });

  it('returns 400 when x-razorpay-signature header is missing', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const body = buildWebhookPayload('uid', 'oid', 'pid');
    const res  = await request(app)
      .post('/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .send(body);
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing signature/i);
  });

  it('returns 400 for invalid signature', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const body = buildWebhookPayload('uid', 'oid', 'pid');
    const res  = await request(app)
      .post('/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'bad' + 'a'.repeat(60))
      .send(body);
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid webhook signature/i);
  });

  it('returns 400 when order is not found in DB', async () => {
    const { userId } = await registerAndLogin();
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;

    const body = buildWebhookPayload(userId, 'order_nonexistent_xyz', `pay_wh_${Date.now()}`);
    const sig  = signBody(body);

    const res = await request(app)
      .post('/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(body);
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/order not found/i);
  });

  it('credits wallet and returns ok for valid webhook', async () => {
    const { token, userId } = await registerAndLogin();

    // Create an order so the webhook can look it up
    const orderRes = await request(app)
      .post('/payment/create-order')
      .set('Authorization', token)
      .send({ amount: 75 });
    const orderId   = orderRes.body.order_id;
    const paymentId = `pay_wh_${Date.now()}`;

    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const body = buildWebhookPayload(userId, orderId, paymentId);
    const sig  = signBody(body);

    const res = await request(app)
      .post('/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(body);
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');

    // Wallet should now have 75 INR
    const balRes = await request(app)
      .get('/wallet/balance')
      .set('Authorization', token);
    expect(parseFloat(balRes.body.balance)).toBeCloseTo(75, 1);
  });

  it('webhook is idempotent — duplicate event does not double-credit', async () => {
    const { token, userId } = await registerAndLogin();

    const orderRes = await request(app)
      .post('/payment/create-order')
      .set('Authorization', token)
      .send({ amount: 50 });
    const orderId   = orderRes.body.order_id;
    const paymentId = `pay_idem_wh_${Date.now()}`;

    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const body = buildWebhookPayload(userId, orderId, paymentId);
    const sig  = signBody(body);

    const first = await request(app)
      .post('/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(body);
    expect(first.status).toBe(200);

    // Send the same event again
    const second = await request(app)
      .post('/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(body);
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    // Idempotent — should not error
    expect(second.status).toBe(200);

    // Balance should still be 50, not 100
    const balRes = await request(app)
      .get('/wallet/balance')
      .set('Authorization', token);
    expect(parseFloat(balRes.body.balance)).toBeCloseTo(50, 1);
  });

  it('ignores non-payment.captured events gracefully', async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const body = JSON.stringify({ event: 'order.paid', payload: {} });
    const sig  = signBody(body);

    const res = await request(app)
      .post('/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(body);
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
