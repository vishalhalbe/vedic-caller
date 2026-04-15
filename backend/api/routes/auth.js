const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const { User } = require('../models');
const jwt      = require('../services/jwt');
const auth     = require('../middleware/authMiddleware');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASS = 8;

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

    const token = jwt.sign({ id: user.id, email: user.email });
    res.status(201).json({ token, user_id: user.id });
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

    const token = jwt.sign({ id: user.id, email: user.email });
    res.json({ token, user_id: user.id });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
// Stateless logout — client discards the token. This endpoint exists so Flutter
// can call it and for future token blacklisting when Redis is wired in (TASK-05).
router.post('/logout', auth, (req, res) => {
  res.json({ success: true });
});

module.exports = router;
