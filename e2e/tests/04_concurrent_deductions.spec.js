const { test, expect } = require('@playwright/test');
const { register, topUpWallet, auth } = require('./helpers');

test.describe('Concurrent Deductions (race condition)', () => {
  test('two simultaneous deductions of ₹60 from ₹100 wallet — only one succeeds', async ({ request }) => {
    const { token } = await register(request);
    await topUpWallet(request, token, 100);

    const headers = { Authorization: `Bearer ${token}` };

    // Fire both deductions simultaneously
    const [res1, res2] = await Promise.all([
      request.post('/wallet/deduct', { data: { amount: 60 }, headers }),
      request.post('/wallet/deduct', { data: { amount: 60 }, headers }),
    ]);

    const statuses = [res1.status(), res2.status()];

    // Exactly one should succeed (200) and one should fail (400 Insufficient)
    expect(statuses).toContain(200);
    expect(statuses).toContain(400);

    // Final balance must be ₹40 — never negative, never ₹100 (both failed), never ₹-20 (both succeeded)
    const balRes = await request.get('/wallet/balance', auth(token));
    const { balance } = await balRes.json();
    expect(balance).toBe(40);
  });

  test('three concurrent deductions: only affordable ones go through', async ({ request }) => {
    const { token } = await register(request);
    await topUpWallet(request, token, 200);

    const headers = { Authorization: `Bearer ${token}` };

    // Three deductions of ₹100 each (only 2 can fit)
    const results = await Promise.all([
      request.post('/wallet/deduct', { data: { amount: 100 }, headers }),
      request.post('/wallet/deduct', { data: { amount: 100 }, headers }),
      request.post('/wallet/deduct', { data: { amount: 100 }, headers }),
    ]);

    const succeeded = results.filter(r => r.status() === 200).length;
    const failed    = results.filter(r => r.status() === 400).length;

    expect(succeeded).toBe(2);
    expect(failed).toBe(1);

    const { balance } = await (await request.get('/wallet/balance', auth(token))).json();
    expect(balance).toBe(0); // ₹200 - ₹100 - ₹100 = ₹0
  });
});
