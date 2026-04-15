const Razorpay = require('razorpay');

let _client = null;

/**
 * Returns a singleton Razorpay SDK instance.
 * Throws clearly if env vars are missing rather than crashing silently.
 */
function getRazorpayClient() {
  if (_client) return _client;

  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in environment');
  }

  _client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return _client;
}

module.exports = { getRazorpayClient };
