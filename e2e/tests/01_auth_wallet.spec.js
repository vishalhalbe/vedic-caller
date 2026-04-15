const { test, expect } = require('@playwright/test');
const { register, auth, topUpWallet } = require('./helpers');

test.describe('Auth & Wallet', () => {
  test('POST /auth/login returns a JWT', async ({ request }) => {
    const { token, userId } = await register(request);
    expect(typeof token).toBe('string');
    // JWT has three dot-separated segments
    expect(token.split('.').length).toBe(3);
    expect(typeof userId).toBe('string');
  });

  test('GET /wallet/balance requires auth', async ({ request }) => {
    const res = await request.get('/wallet/balance');
    expect(res.status()).toBe(401);
  });

  test('GET /wallet/balance returns 0 for new user', async ({ request }) => {
    const { token } = await register(request);
    const res = await request.get('/wallet/balance', auth(token));
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.balance).toBe(0);
  });

  test('wallet top-up credits correct amount', async ({ request }) => {
    const { token } = await register(request);
    const { status, balance } = await topUpWallet(request, token, 500);
    expect(status).toBe(200);
    expect(balance).toBe(500);
  });

  test('multiple top-ups accumulate correctly', async ({ request }) => {
    const { token } = await register(request);
    await topUpWallet(request, token, 100);
    await topUpWallet(request, token, 200);
    const { balance } = await topUpWallet(request, token, 300);
    expect(balance).toBe(600);
  });

  test('POST /payment/create-order requires auth', async ({ request }) => {
    const res = await request.post('/payment/create-order', { data: { amount: 100 } });
    expect(res.status()).toBe(401);
  });

  test('POST /payment/create-order rejects invalid amount', async ({ request }) => {
    const { token } = await register(request);
    const res = await request.post('/payment/create-order', {
      data: { amount: -50 },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /payment/success rejects forged signature', async ({ request }) => {
    const { token } = await register(request);
    const orderRes = await request.post('/payment/create-order', {
      data: { amount: 500 },
      headers: { Authorization: `Bearer ${token}` },
    });
    const order = await orderRes.json();
    const res = await request.post('/payment/success', {
      data: {
        order_id:   order.order_id,
        payment_id: 'pay_fake_123',
        signature:  'not_a_valid_hmac',
        amount:     500,
      },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/signature/i);
  });
});
