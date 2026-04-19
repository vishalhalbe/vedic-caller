const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/authMiddleware');
const supabase   = require('../config/db');
const { atomicCredit } = require('../services/walletEngine');

router.get('/balance', auth, async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, wallet_balance')
      .eq('id', req.user.id)
      .single();

    if (error || !user) return res.status(404).json({ error: 'User not found' });
    res.json({ balance: parseFloat(user.wallet_balance) });
  } catch (err) {
    next(err);
  }
});

if (process.env.NODE_ENV !== 'production') {
  router.post('/test-credit', auth, async (req, res, next) => {
    try {
      const { amount } = req.body;
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      const ref    = `test_credit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const result = await atomicCredit(req.user.id, parseFloat(amount), ref);
      res.json({ balance: result.balance });
    } catch (err) {
      next(err);
    }
  });
}

module.exports = router;
