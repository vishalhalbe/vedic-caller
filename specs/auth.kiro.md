# KIRO Spec: Auth (OTP + JWT)

## Intent
User logs in via phone OTP and receives JWT for session.

## Inputs
- phone
- otp

## Outputs
- jwt_token

## Rules
1. Phone must be valid
2. OTP must match generated OTP
3. JWT expires in 30 days

## States
- INIT → OTP_SENT → VERIFIED → AUTHENTICATED

## Edge Cases
- Invalid OTP → reject
- Expired OTP → regenerate

## Observability
- Log login attempts
- Track failures
