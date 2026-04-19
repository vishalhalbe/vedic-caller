const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const supabase = require('../config/db');
const jwt      = require('../services/jwt');
const auth     = require('../middleware/authMiddleware');

const EMAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASS    = 8;
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000;

async function issueTokens(userId, email, isAdmin = false) {
  const token      = jwt.signAccess({ id: userId, email });
  const rawRefresh = crypto.randomBytes(32).toString('hex');
  const tokenHash  = crypto.createHash('sha256').update(rawRefresh).digest('hex');
  const expiresAt  = new Date(Date.now() + REFRESH_TTL).toISOString();

  const { error } = await supabase.from('refresh_tokens').insert({
    user_id:    userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
    revoked:    false,
  });
  if (error) throw new Error(error.message);

  return { token, refresh_token: rawRefresh, user_id: userId, is_admin: isAdmin };
}

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name = '' } = req.body;

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    if (!password || password.length < MIN_PASS) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASS} characters` });
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase
      .from('users')
      .insert({ email: email.toLowerCase(), password_hash, name, wallet_balance: 0 })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const result = await issueTokens(user.id, user.email, user.is_admin === true);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, email, password_hash, is_admin')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const result = await issueTokens(user.id, user.email, user.is_admin === true);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

    const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');

    const { data: record } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!record) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    await supabase
      .from('refresh_tokens')
      .update({ revoked: true })
      .eq('id', record.id);

    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', record.user_id)
      .single();

    if (!user) return res.status(401).json({ error: 'User not found' });

    const { token, refresh_token: newRefresh } = await issueTokens(user.id, user.email);
    res.json({ token, refresh_token: newRefresh });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', auth, async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      const tokenHash = crypto.createHash('sha256').update(refresh_token).digest('hex');
      await supabase
        .from('refresh_tokens')
        .update({ revoked: true })
        .eq('token_hash', tokenHash);
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
