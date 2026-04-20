# Skill: Backend Production System (Vedic Caller)

## Goal
Operate a production-safe Node.js/Express backend for a real-money voice consulting platform — covering atomic payments, idempotent APIs, Razorpay integration, and call lifecycle management.

## Architecture

```
app.js  →  Middleware chain  →  Routes  →  Services  →  DB
              │
              ├── logger (structured request logs)
              ├── rateLimiter (global abuse prevention)
              ├── express.json() (body parsing)
              └── idempotency (in-memory deduplication)
```

**Service Layer:**
- `callLifecycle.js` — tracks call session with start timestamp
- `walletEngine.js` — atomic `SELECT FOR UPDATE` balance deduction
- `billingEngine.js` — per-second billing accumulator
- `razorpayService.js` — HMAC-SHA256 signature verification
- `idempotency_simple.js` — in-memory key→response cache

## Key Concepts

1. **Atomic deduction** — `walletEngine.atomicDeduct` wraps balance check + deduct + transaction log in a single `sequelize.transaction()` with row-level lock.
2. **Idempotency** — `Idempotency-Key` header caches response in memory; identical retries return cached result without re-executing.
3. **Signature verification** — Razorpay payments verified via `HMAC-SHA256(orderId|paymentId, secret)` before crediting wallet.
4. **Server-side billing** — cost is always `(rate / 60) * duration` computed on `endCall`; client timer is display-only.
5. **Graceful DB failure** — server starts even if DB is unavailable (non-critical for static routes).

## Quick Start

```bash
cd backend/api
npm install
node app.js   # PORT=3000 by default
```

### Core Call Flow
```
POST /call/start  → { channel, token }        (Agora join details)
   ... call in progress ...
POST /call/end    → { duration, cost }         (deducts wallet atomically)
```

### Wallet Deduction (direct)
```
POST /wallet/deduct
Body: { balance: 200, rate: 60, seconds: 90 }
→    { remaining: 110 }   // 200 - (60/60)*90 = 200 - 90 = 110
```

### Payment Recording
```
POST /payment/success
Body: { user_id, amount, reference }
→    { success: true }     // credits wallet via Transaction.create
```

## Rules / Invariants

- **Never allow negative balance** — `atomicDeduct` throws `'Insufficient balance'` if balance < amount
- **Always verify Razorpay signatures** — skip only if `RAZORPAY_WEBHOOK_SECRET` is unset (dev mode)
- **All mutating endpoints must accept `Idempotency-Key`** — safe for mobile retries
- **Rate is stored per-minute, billed per-second** — formula: `cost = (rate_per_minute / 60) * seconds`
- **Call cost computed server-side** — never trust `cost` submitted by client

## Common Patterns

### Adding a protected route
```javascript
const auth = require('../middleware/authMiddleware');
router.post('/my-endpoint', auth, async (req, res) => {
  const userId = req.user.id;
  // ...
});
```

### Safe wallet operation
```javascript
const { atomicDeduct } = require('../services/walletEngine');
await atomicDeduct(userId, amount); // throws on insufficient balance
```

### Idempotent webhook handler
```javascript
// Include Idempotency-Key in request header
// Middleware auto-caches and replays response on duplicate
```

## Files

| File | Role |
|------|------|
| `app.js` | App bootstrap, middleware, route mounting |
| `routes/auth.js` | Phone login → JWT |
| `routes/call.js` | Call start/end |
| `routes/wallet.js` | Wallet deduction |
| `routes/webhook_v2.js` | Razorpay webhook |
| `routes/payment_simple.js` | Direct payment credit |
| `routes/metrics.js` | Health + memory metrics |
| `services/callLifecycle.js` | Session start/end logic |
| `services/walletEngine.js` | Atomic DB deduction |
| `services/billingEngine.js` | Billing accumulator |
| `services/razorpayService.js` | Signature verification |
| `middleware/authMiddleware.js` | JWT verification |
| `middleware/idempotencyMiddleware_v2.js` | Request dedup |
| `middleware/rateLimiter.js` | Global rate limit |

## Outputs
- Zero duplicate payments
- No negative wallet balances
- Accurate per-second call billing
- Safe retry behaviour on all mutating endpoints
