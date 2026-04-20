const express    = require('express');
const router     = express.Router();
const supabase   = require('../config/db');

router.post('/seed', async (req, res, next) => {
  try {
    const secret = process.env.ADMIN_SEED_SECRET;
    if (!secret) return res.status(500).json({ error: 'ADMIN_SEED_SECRET not configured' });
    if (req.headers['x-seed-secret'] !== secret) return res.status(401).json({ error: 'Unauthorized' });

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const { data: user } = await supabase
      .from('users')
      .select('id, is_admin')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (!user) return res.status(404).json({ error: 'User not found — register first' });
    if (user.is_admin) return res.json({ message: 'User is already an admin', user_id: user.id });

    await supabase.from('users').update({ is_admin: true }).eq('id', user.id);
    res.json({ message: 'User promoted to admin', user_id: user.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
