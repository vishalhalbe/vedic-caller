const jwt = require('../services/jwt');
const { User } = require('../models');

const auth = (req, res, next) => {
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

const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ['is_admin'] });
    if (!user?.is_admin) return res.status(403).json({ error: 'Admin only' });
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = auth;
module.exports.requireAdmin = requireAdmin;
