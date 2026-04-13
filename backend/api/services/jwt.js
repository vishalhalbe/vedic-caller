const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

exports.sign = (data) => jwt.sign(data, SECRET, { expiresIn: '30d' });
exports.verify = (token) => jwt.verify(token, SECRET);
