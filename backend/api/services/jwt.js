const jwt = require('jsonwebtoken');

const SECRET = 'secret';

exports.sign = (data) => jwt.sign(data, SECRET);
exports.verify = (token) => jwt.verify(token, SECRET);