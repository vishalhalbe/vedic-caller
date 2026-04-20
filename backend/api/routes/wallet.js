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

router.get('/transactions', auth, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('transactions')
      .select('id, type, amount, reference, created_at', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);
    res.json({
      data: data || [],
      pagination: { total: count ?? 0, page, limit, pages: Math.ceil((count ?? 0) / limit) },
    });
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
