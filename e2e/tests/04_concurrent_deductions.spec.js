const { test, expect } = require('@playwright/test');
const { register, topUpWallet, auth, razorpaySignature } = require('./helpers');

test.describe('Concurrent Deductions (race condition)', () => {
  test('concurrent payment captures with same payment_id — only one credits wallet', async ({ request }) => {
    const { token } = await register(request);

    // Create an order
    const orderRes = await request.post('/payment/create-order', {
      data: { amount: 100 },
      headers: { Authorization: `Bearer ${token}` },
    });
    const order = await orderRes.json();
    const paymentId = `pay_race_${Date.now()}`;
    const signature = razorpaySignature(order.order_id, paymentId);
    const payload = { order_id: order.order_id, payment_id: paymentId, signature };
    const headers = { Authorization: `Bearer ${token}` };

    // Fire both /payment/success concurrently with the same payment_id
    const [res1, res2] = await Promise.all([
      request.post('/payment/success', { data: payload, headers }),
      request.post('/payment/success', { data: payload, headers }),
    ]);

    // Both must complete without 500; the second is idempotent (200) or conflict (409)
    expect([200, 409]).toContain(res1.status());
    expect([200, 409]).toContain(res2.status());

    // Balance must reflect exactly ONE ₹100 credit — never ₹200
    const { balance } = await (await request.get('/wallet/balance', auth(token))).json();
    expect(balance).toBe(100);
  });

  test('sequential call/start+end drains balance correctly without going negative', async ({ request }) => {
    const { token } = await register(request);
    await topUpWallet(request, token, 50);

    const astrologers = await (await request.get('/astrologer')).json();
    if (!astrologers.length) { test.skip(); return; }
    const astro = astrologers[0];

    // Call 1 — should succeed (balance > rate/60)
    const start1 = await request.post('/call/start', {
      data: { astrologer_id: astro.id },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(start1.status()).toBe(200);
    const { call_id } = await start1.json();

    await request.post('/call/end', {
      data: { call_id },
      headers: { Authorization: `Bearer ${token}` },
    });

    // Wallet balance reduced — verify it didn't go negative
    const { balance } = await (await request.get('/wallet/balance', auth(token))).json();
    expect(balance).toBeGreaterThanOrEqual(0);
    expect(balance).toBeLessThanOrEqual(50);
  });

  test('insufficient balance prevents call start atomically', async ({ request }) => {
    // User starts with just barely enough for one second of a ₹600/min astrologer
    const { token } = await register(request);
    // Balance = ₹0 — can't afford any call
    const astrologers = await (await request.get('/astrologer')).json();
    if (!astrologers.length) { test.skip(); return; }

    const res = await request.post('/call/start', {
      data: { astrologer_id: astrologers[0].id },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/insufficient/i);

    // Balance unchanged
    const { balance } = await (await request.get('/wallet/balance', auth(token))).json();
    expect(balance).toBe(0);
  });
});
