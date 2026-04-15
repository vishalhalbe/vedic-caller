const jwt = require('../services/jwt');

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });

  // Accept both "Bearer <token>" and raw token (backwards-compat)
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;

  try {
    req.user = jwt.verify(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};