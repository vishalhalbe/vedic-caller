const crypto = require('crypto');

exports.verifySignature = (orderId, paymentId, signature, secret) => {
  const body = orderId + '|' + paymentId;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return expected === signature;
};
