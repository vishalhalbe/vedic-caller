const crypto = require('crypto');

exports.verifySignature = (orderId, paymentId, signature, secret) => {
  const body = orderId + '|' + paymentId;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  // Use timing-safe comparison to prevent timing-based signature forgery (issue #4)
  try {
    const expectedBuf = Buffer.from(expected,   'hex');
    const actualBuf   = Buffer.from(signature,  'hex');
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
};
