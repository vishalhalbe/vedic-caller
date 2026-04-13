# Skill: Backend Production System (Vedic Caller)

## Goal
Ensure backend is production-safe: payments, concurrency, retries, monitoring

## Steps
1. Use DB transactions with row locking
2. Implement idempotency (Redis preferred)
3. Verify Razorpay signatures
4. Track call start/end timestamps
5. Deduct wallet atomically

## Rules
- Never allow negative balance
- Always verify payment signature
- All critical APIs must be idempotent

## Outputs
- Stable billing
- No duplicate payments
- Accurate call cost
