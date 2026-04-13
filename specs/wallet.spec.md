# Wallet Deduction Spec

## Rule
Cost = (rate_per_minute / 60) * seconds

## Cases
- 60 sec at ₹60/min → ₹60
- 30 sec at ₹60/min → ₹30
- 90 sec at ₹120/min → ₹180

## Constraints
- Balance must not go negative
- Auto stop when balance < 1 min cost
