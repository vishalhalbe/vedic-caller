# Skill: Billing Engine & Payments (JyotishConnect)

## Goal
Implement and maintain accurate, tamper-proof per-second billing for voice calls and safe Razorpay payment processing with webhook verification.

## Core Formula

```
cost = (rate_per_minute / 60) * duration_seconds
```

**Example:** Rate = ₹60/min, Duration = 90s → Cost = (60/60) × 90 = **₹90**

All cost calculations happen **server-side** on `POST /call/end`. The Flutter timer is display-only.

## Billing Components

### `billingEngine.js`
Accumulates cost second-by-second (useful for per-tick billing):
```javascript
exports.runBilling = (rate, duration) => {
  let total = 0;
  for (let i = 1; i <= duration; i++) {
    total += calculateDeduction(rate, 1);  // (rate/60) * 1
  }
  return total;
};
```

### `walletService.js`
Single deduction calculation:
```javascript
exports.calculateDeduction = (rate, seconds) => {
  return (rate / 60) * seconds;
};
```

### `callLifecycle.js`
Session lifecycle — end call triggers billing:
```javascript
exports.endCall = async (session) => {
  const duration = Math.floor((Date.now() - session.startTime) / 1000);
  const cost = (session.rate / 60) * duration;
  await atomicDeduct(session.userId, cost);
  return { duration, cost };
};
```

### `walletEngine.js`
Atomic deduction with pessimistic row lock:
```javascript
exports.atomicDeduct = async (userId, amount) => {
  return await sequelize.transaction(async (t) => {
    const wallet = await sequelize.query(
      `SELECT balance FROM wallets WHERE user_id = :userId FOR UPDATE`,
      { replacements: { userId }, transaction: t }
    );
    const balance = wallet[0][0].balance;
    if (balance < amount) throw new Error('Insufficient balance');

    await sequelize.query(
      `UPDATE wallets SET balance = balance - :amount WHERE user_id = :userId`,
      { replacements: { amount, userId }, transaction: t }
    );

    await Transaction.create({ user_id: userId, amount, type: 'debit', status: 'success' }, { transaction: t });
    return true;
  });
};
```

## Payment Flow (Razorpay)

### Direct Credit (`/payment/success`)
Simple flow — no signature check (used for testing / manual credit):
```
POST /payment/success
{ user_id, amount, reference }
→ Transaction.create({ type: 'credit', status: 'success' })
```

### Webhook Flow (`/webhook/razorpay`)
Production flow — signature-verified:
```
1. Razorpay fires POST /webhook/razorpay on payment.captured
2. Verify: HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET) === x-razorpay-signature
3. Extract: payment.notes.user_id + payment.amount (paise → ₹ /100)
4. Credit: Transaction.create({ type: 'credit', status: 'success', reference: payment.id })
```

### Signature Verification (`razorpayService.js`)
```javascript
exports.verifySignature = (orderId, paymentId, signature, secret) => {
  const body = orderId + '|' + paymentId;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
};
```

## Key Rules

- **Never trust client-submitted cost** — always recompute from `rate` + `duration` on server
- **Reject webhook if signature invalid** — return `400 Invalid webhook signature`
- **Amount in paise from Razorpay** — divide by 100 to get INR: `payment.amount / 100`
- **Wallet can never go negative** — `atomicDeduct` throws before deducting
- **Every debit/credit creates a Transaction record** — full audit trail

## Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Balance exactly equals cost | Succeeds; balance becomes 0 |
| Balance less than cost | Throws `'Insufficient balance'`; call blocked |
| Duplicate webhook event | Idempotency-Key header or reference check prevents double credit |
| Call ends with 0 seconds | `cost = 0`; no deduction needed |
| Razorpay webhook secret not set | Signature check skipped (dev mode only) |

## Files

| File | Role |
|------|------|
| `services/billingEngine.js` | Per-second billing accumulator |
| `services/walletService.js` | Cost formula |
| `services/walletEngine.js` | Atomic DB deduction |
| `services/callLifecycle.js` | Call session + billing trigger |
| `services/razorpayService.js` | Payment signature verification |
| `routes/webhook_v2.js` | Razorpay webhook handler |
| `routes/payment_simple.js` | Direct payment credit |
| `routes/wallet.js` | Manual deduction endpoint |

## Outputs
- Accurate billing to the second
- Zero double-charges
- Full transaction audit trail
- Tamper-proof payment capture
