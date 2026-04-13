const jwt = require('../services/jwt');

module.exports = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).send('Unauthorized');

  try {
    req.user = jwt.verify(token);
    next();
  } catch {
    res.status(401).send('Invalid token');
  }
};