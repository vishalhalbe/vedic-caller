/**
 * One-time admin bootstrap endpoint.
 * Protected by ADMIN_SEED_SECRET header — NOT by requireAdmin
 * (since there is no admin yet when this is first called).
 *
 * Usage:
 *   curl -X POST http://localhost:3000/admin/seed \
 *     -H 'x-seed-secret: <ADMIN_SEED_SECRET>' \
 *     -H 'Content-Type: application/json' \
 *     -d '{"email":"admin@example.com"}'
 *
 * Set ADMIN_SEED_SECRET in .env before deploying.
 */
const express = require('express');
const router  = express.Router();
const { User } = require('../models');

router.post('/seed', async (req, res, next) => {
  try {
    const secret = process.env.ADMIN_SEED_SECRET;
    if (!secret) {
      return res.status(500).json({ error: 'ADMIN_SEED_SECRET not configured' });
    }
    if (req.headers['x-seed-secret'] !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) return res.status(404).json({ error: 'User not found — register first' });
    if (user.is_admin) return res.json({ message: 'User is already an admin', user_id: user.id });

    await user.update({ is_admin: true });
    res.json({ message: 'User promoted to admin', user_id: user.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
