# KIRO Spec: Call Lifecycle

## Intent
User connects to astrologer and is billed per second.

## Inputs
- user_id
- astrologer_id

## Outputs
- call_session_id
- billing events

## Rules
1. Call starts only if wallet >= 3 min cost
2. Billing per second
3. Auto-end if balance < 1 min cost

## States
IDLE → CONNECTING → ACTIVE → ENDED

## Edge Cases
- Network drop → retry once
- Low balance → warn + end

## Observability
- Track duration
- Track cost per call
