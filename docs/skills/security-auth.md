# Skill: Security & Authentication (JyotishConnect)

## Goal
Implement and maintain secure authentication, request validation, and payment verification for a real-money platform — covering JWT auth, HMAC verification, rate limiting, idempotency, and Supabase RLS.

## Auth Flow

```
Flutter                     Backend
  │                            │
  ├─ POST /auth/login ────────►│
  │   { phone }                │  Validate phone
  │                            │  Sign JWT (HS256, JWT_SECRET)
  │◄── { token } ─────────────┤
  │                            │
  ├─ Store token (secure)      │
  │                            │
  ├─ GET /astrologer ─────────►│
  │  Authorization: <token>    │  authMiddleware:
  │                            │    jwt.verify(token, secret)
  │◄── 200 / 401 ─────────────┤    → req.user = payload
```

### JWT Service (`services/jwt.js`)
```javascript
// sign on login:
jwt.sign({ id: userId, phone }, process.env.JWT_SECRET, { expiresIn: '30d' })

// verify on each protected request:
jwt.verify(token, process.env.JWT_SECRET)
```

### Auth Middleware (`middleware/authMiddleware.js`)
```javascript
module.exports = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).send('Unauthorized');
  try {
    req.user = jwt.verify(token);
    next();
  } catch {
    res.status(401).send('Invalid token');
  }
};
```

**Apply to protected routes:**
```javascript
router.post('/call/end', authMiddleware, handler);
router.post('/wallet/deduct', authMiddleware, handler);
```

## Payment Security

### Razorpay Webhook HMAC (`routes/webhook_v2.js`)
```javascript
const signature = req.headers['x-razorpay-signature'];
const body = JSON.stringify(req.body);
const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

if (signature !== expected) return res.status(400).json({ error: 'Invalid webhook signature' });
```

### Signature Verification for Orders (`razorpayService.js`)
```javascript
exports.verifySignature = (orderId, paymentId, signature, secret) => {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
};
```

**Never credit wallet without verified signature in production.**

## Rate Limiting (`middleware/rateLimiter.js`)

Global rate limiter applied to all routes:
- Prevents brute-force attacks on `/auth/login`
- Blocks API abuse and DDoS attempts
- Configured per IP with sliding window

## Idempotency (`middleware/idempotencyMiddleware_v2.js`)

Prevents duplicate operations on retry:
```javascript
const key = req.headers['idempotency-key'];
if (key) {
  const cached = check(key);
  if (cached) return res.json(cached);  // replay without re-executing
  // intercept response to cache it
}
```

**Clients must send `Idempotency-Key: <uuid>` on all mutating requests.**

## Supabase RLS (Database Layer)

Final security layer — enforced at DB level even if API auth is bypassed:
- Users can only `SELECT/UPDATE/INSERT` their own rows
- `astrologers` is publicly readable (browse marketplace)
- No user can read another user's calls or transactions

See `skills/database-schema.md` for full policy list.

## Security Checklist

| Control | Status | Location |
|---------|--------|----------|
| JWT auth on protected routes | Implemented | `middleware/authMiddleware.js` |
| Razorpay webhook HMAC | Implemented | `routes/webhook_v2.js` |
| Rate limiting | Implemented | `middleware/rateLimiter.js` |
| Idempotency | Implemented | `middleware/idempotencyMiddleware_v2.js` |
| RLS data isolation | Implemented | Supabase migration SQL |
| Input validation on `/auth/login` | Basic | `routes/auth.js` |
| CORS policy | Enabled (permissive) | `app.js` |
| Server-side billing | Implemented | `callLifecycle.js` |

## Vulnerabilities to Address

| Risk | Severity | Fix |
|------|----------|-----|
| Demo JWT token in `auth.js` | Critical | Implement real JWT signing with `JWT_SECRET` |
| CORS `*` (open) | Medium | Restrict to mobile app domain/deep-link |
| No phone OTP verification | High | Add OTP flow (Twilio/AWS SNS) |
| In-memory idempotency resets on restart | Medium | Use Redis or DB-backed idempotency for production |
| Webhook secret optional in dev | Low | Enforce in production via env check |

## Rules

- **`JWT_SECRET` must be a strong random string** — minimum 32 characters
- **Razorpay secrets never logged** — mask in structured logger
- **All money endpoints require auth** — `/wallet/deduct`, `/call/end`, `/payment/success`
- **Webhook endpoint must never require JWT auth** — it's server-to-server (Razorpay → your server)
- **CORS must be restricted in production** — not `*`

## Outputs
- Authenticated API access
- Tamper-proof payment processing
- Zero cross-user data leakage
- Safe retry behaviour via idempotency
