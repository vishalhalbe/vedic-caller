const { test, expect } = require('@playwright/test');
const { register, auth, razorpaySignature, topUpWallet } = require('./helpers');

test.describe('Idempotency & Double-spend Prevention', () => {
  test('same payment_id credited only once', async ({ request }) => {
    const { token } = await register(request);

    // Step 1: create order
    const orderRes = await request.post('/payment/create-order', {
      data: { amount: 500 },
      headers: { Authorization: `Bearer ${token}` },
    });
    const order = await orderRes.json();
    const paymentId = `pay_idem_${Date.now()}`;
    const signature = razorpaySignature(order.order_id, paymentId);

    const payload = {
      order_id:   order.order_id,
      payment_id: paymentId,
      signature,
      amount:     500,
    };

    // First submission — should succeed
    const res1 = await request.post('/payment/success', {
      data: payload,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res1.status()).toBe(200);
    const body1 = await res1.json();
    expect(body1.balance).toBe(500);

    // Second submission — same payment_id — should NOT double-credit
    const res2 = await request.post('/payment/success', {
      data: payload,
      headers: { Authorization: `Bearer ${token}` },
    });
    // Either idempotent 200 or conflict 409 — balance must not change
    expect([200, 409]).toContain(res2.status());

    const balRes = await request.get('/wallet/balance', auth(token));
    const { balance } = await balRes.json();
    expect(balance).toBe(500); // NOT 1000
  });

  test('Idempotency-Key header prevents duplicate wallet deductions', async ({ request }) => {
    const { token } = await register(request);
    await topUpWallet(request, token, 1000);

    const idempotencyKey = `deduct-${Date.now()}`;
    const deductPayload = { amount: 100 };
    const headers = { Authorization: `Bearer ${token}`, 'Idempotency-Key': idempotencyKey };

    const res1 = await request.post('/wallet/deduct', { data: deductPayload, headers });
    expect(res1.status()).toBe(200);

    // Identical request with same Idempotency-Key
    const res2 = await request.post('/wallet/deduct', { data: deductPayload, headers });
    expect(res2.status()).toBe(200);

    // Balance should reflect only ONE deduction
    const { balance } = await (await request.get('/wallet/balance', auth(token))).json();
    expect(balance).toBe(900); // 1000 - 100, NOT 1000 - 200
  });

  test('insufficient balance is rejected atomically', async ({ request }) => {
    const { token } = await register(request);
    await topUpWallet(request, token, 100);

    const res = await request.post('/wallet/deduct', {
      data: { amount: 150 },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/insufficient/i);

    // Balance unchanged
    const { balance } = await (await request.get('/wallet/balance', auth(token))).json();
    expect(balance).toBe(100);
  });
});
