const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

// Short-lived access token (TASK-11)
// jti nonce ensures every token is unique even when issued within the same second.
exports.signAccess = (data) =>
  jwt.sign({ ...data, jti: crypto.randomBytes(8).toString('hex') }, SECRET, { expiresIn: '15m' });
// Legacy — kept so old signed tokens continue to verify until natural expiry
exports.sign   = (data) => jwt.sign(data, SECRET, { expiresIn: '7d' });
exports.verify = (token) => jwt.verify(token, SECRET);
