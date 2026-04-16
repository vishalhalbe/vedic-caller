const express        = require('express');
const router         = express.Router();
const bcrypt         = require('bcryptjs');
const crypto         = require('crypto');
const { User, RefreshToken } = require('../models');
const jwt            = require('../services/jwt');
const auth           = require('../middleware/authMiddleware');

const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASS    = 8;
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// Helper: issue access JWT (15min) + refresh token (30d, stored as hash in DB)
async function issueTokens(userId, email) {
  const token      = jwt.signAccess({ id: userId, email });
  const rawRefresh = crypto.randomBytes(32).toString('hex');
  const tokenHash  = crypto.createHash('sha256').update(rawRefresh).digest('hex');
  const expiresAt  = new Date(Date.now() + REFRESH_TTL);

  await RefreshToken.create({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });

  return { token, refresh_token: rawRefresh, user_id: userId };
}

// POST /auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name = '' } = req.body;

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    if (!password || password.length < MIN_PASS) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASS} characters` });
    }

    const existing = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      password_hash,
      name,
      wallet_balance: 0,
    });

    const result = await issueTokens(user.id, user.email);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const result = await issueTokens(user.id, user.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh
// Body: { refresh_token: '<raw 64-char hex>' }
// Returns: { token, refresh_token } (token rotation — old token is revoked)
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: 'refresh_token required' });
    }

    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');
    const record    = await RefreshToken.findOne({ where: { token_hash: tokenHash, revoked: false } });

    if (!record) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    if (new Date() > record.expires_at) {
      await record.update({ revoked: true });
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Revoke used token before issuing new one (rotation prevents reuse)
    await record.update({ revoked: true });

    const user = await User.findByPk(record.user_id, { attributes: ['id', 'email'] });
    if (!user) return res.status(401).json({ error: 'User not found' });

    const { token, refresh_token: newRefresh } = await issueTokens(user.id, user.email);
    res.json({ token, refresh_token: newRefresh });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
// Body: { refresh_token: '...' } — revokes refresh token so it cannot be reused.
// Access token expiry (15min) handles the rest — no blacklist needed.
router.post('/logout', auth, async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');
      await RefreshToken.update({ revoked: true }, { where: { token_hash: tokenHash } });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
