/**
 * TASK-03: Verify that /payment/success uses the server-stored order amount,
 * not the client-supplied amount.
 */
const { test, expect } = require('@playwright/test');
const { register, razorpaySignature } = require('./helpers');

test.describe('Payment amount verification', () => {
  test('credits the server-stored amount (not client-supplied)', async ({ request }) => {
    const { token, userId } = await register(request);

    // Create an order for ₹100
    const orderRes = await request.post('/payment/create-order', {
      data: { amount: 100 },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(orderRes.status()).toBe(200);
    const { order_id } = await orderRes.json();

    const payment_id = `pay_test_${Date.now()}`;
    const signature  = razorpaySignature(order_id, payment_id);

    // Submit /payment/success with a fraudulently inflated amount
    const successRes = await request.post('/payment/success', {
      data: { order_id, payment_id, signature, amount: 99999 },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(successRes.status()).toBe(200);
    const body = await successRes.json();

    // Balance should be ₹100 (server-stored), not ₹99999
    expect(body.balance).toBeCloseTo(100, 2);
  });

  test('second /payment/success with same payment_id is idempotent', async ({ request }) => {
    const { token } = await register(request);

    const orderRes = await request.post('/payment/create-order', {
      data: { amount: 200 },
      headers: { Authorization: `Bearer ${token}` },
    });
    const { order_id } = await orderRes.json();
    const payment_id = `pay_idem_${Date.now()}`;
    const signature  = razorpaySignature(order_id, payment_id);

    const payload = { order_id, payment_id, signature, amount: 200 };
    const headers = { Authorization: `Bearer ${token}` };

    const r1 = await request.post('/payment/success', { data: payload, headers });
    const r2 = await request.post('/payment/success', { data: payload, headers });

    expect(r1.status()).toBe(200);
    // Second call: order is already 'paid', returns current balance without double-crediting
    expect(r2.status()).toBe(200);
    const b2 = await r2.json();
    expect(b2.balance).toBeCloseTo(200, 2); // not 400
  });
});
