// Shared helpers for all E2E specs
const crypto = require('crypto');

let _counter = Date.now();
function uniqueEmail() {
  return `e2e_${++_counter}_${Date.now()}@test.jyotishconnect.com`;
}

const DEFAULT_PASSWORD = 'TestPass99!';

/**
 * Register a new user and return { token, userId }.
 * Each call creates a fresh user so tests stay independent.
 */
async function register(request) {
  const email = uniqueEmail();
  const res = await request.post('/auth/register', {
    data: { email, password: DEFAULT_PASSWORD },
  });
  const body = await res.json();
  return { token: body.token, userId: body.user_id, email };
}

/** Auth header object ready for request.fetch options */
function auth(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

/**
 * Compute a valid Razorpay payment signature for tests.
 * Mirrors backend/api/services/paymentService.js
 */
function razorpaySignature(orderId, paymentId) {
  const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

/**
 * Credit wallet directly via the dev-only /wallet/test-credit endpoint.
 * In production this endpoint doesn't exist — tests always run with NODE_ENV != production.
 */
async function topUpWallet(request, token, amountInr) {
  const res = await request.post('/wallet/test-credit', {
    data: { amount: amountInr },
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return { status: res.status(), balance: body.balance };
}

module.exports = { register, auth, razorpaySignature, topUpWallet, uniqueEmail };
