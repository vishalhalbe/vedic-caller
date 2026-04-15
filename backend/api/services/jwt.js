const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

exports.sign = (data) => jwt.sign(data, SECRET, { expiresIn: '7d' }); // reduced from 30d (issue #18)
exports.verify = (token) => jwt.verify(token, SECRET);
