const { verifySignature } = require('./razorpayService');

/**
 * Verify a Razorpay order payment.
 * @param {string} orderId    - Razorpay order_id
 * @param {string} paymentId  - Razorpay payment_id
 * @param {string} signature  - Signature from Razorpay callback
 * @returns {boolean}
 */
exports.verifyPayment = (orderId, paymentId, signature) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error('RAZORPAY_KEY_SECRET not configured');
  return verifySignature(orderId, paymentId, signature, secret);
};
