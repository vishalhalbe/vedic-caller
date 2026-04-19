const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const supabase = require('../config/db');
const jwt      = require('../services/jwt');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASS = 8;

// POST /astrologer/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, rate_per_minute = 10 } = req.body;

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }
    if (!password || password.length < MIN_PASS) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASS} characters` });
    }
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name required' });
    }
    if (parseFloat(rate_per_minute) <= 0) {
      return res.status(400).json({ error: 'rate_per_minute must be positive' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { data: astrologer, error } = await supabase
      .from('astrologers')
      .insert({
        name:            name.trim(),
        email:           email.toLowerCase(),
        password_hash,
        rate_per_minute: parseFloat(rate_per_minute),
        is_available:    false,
      })
      .select('id, name, email, rate_per_minute')
      .single();

    if (error) {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      throw new Error(error.message);
    }

    const token = jwt.signAccess({ id: astrologer.id, email: astrologer.email, role: 'astrologer' });
    res.status(201).json({ token, astrologer_id: astrologer.id, name: astrologer.name });
  } catch (err) {
    next(err);
  }
});

// POST /astrologer/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const { data: astrologer } = await supabase
      .from('astrologers')
      .select('id, name, email, password_hash, rate_per_minute, earnings_balance')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (!astrologer || !astrologer.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, astrologer.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.signAccess({ id: astrologer.id, email: astrologer.email, role: 'astrologer' });
    res.json({
      token,
      astrologer_id:    astrologer.id,
      name:             astrologer.name,
      rate_per_minute:  parseFloat(astrologer.rate_per_minute),
      earnings_balance: parseFloat(astrologer.earnings_balance || 0),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
