# API Documentation

## Auth
POST /auth/login
- body: { phone }
- response: { token }

## Wallet
POST /wallet/deduct
- body: { balance, rate, seconds }

## Call
POST /call/start
POST /call/end

## Astrologer
GET /astrologer
