const express  = require('express');
const router   = express.Router();
const auth     = require('../middleware/authMiddleware');
const { requireAstrologer } = require('../middleware/authMiddleware');
const supabase = require('../config/db');

// GET /astrologer/me — profile + earnings
router.get('/me', auth, requireAstrologer, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('astrologers')
      .select('id, name, email, rate_per_minute, is_available, earnings_balance, bio, photo_url, specialty')
      .eq('id', req.user.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Astrologer not found' });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /astrologer/me/availability — toggle own availability
router.post('/me/availability', auth, requireAstrologer, async (req, res, next) => {
  try {
    const { available } = req.body;
    if (typeof available !== 'boolean') {
      return res.status(400).json({ error: 'available (boolean) required' });
    }

    // Cannot go online while on an active call
    if (available) {
      const { data: activeCall } = await supabase
        .from('calls')
        .select('id')
        .eq('astrologer_id', req.user.id)
        .eq('status', 'active')
        .limit(1);

      if (activeCall && activeCall.length > 0) {
        return res.status(400).json({ error: 'Cannot change availability during an active call' });
      }
    }

    const { data, error } = await supabase
      .from('astrologers')
      .update({ is_available: available })
      .eq('id', req.user.id)
      .select('id, is_available, earnings_balance')
      .single();

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /astrologer/me/earnings — earnings summary + recent history
router.get('/me/earnings', auth, requireAstrologer, async (req, res, next) => {
  try {
    const { data: astrologer } = await supabase
      .from('astrologers')
      .select('earnings_balance')
      .eq('id', req.user.id)
      .single();

    const { data: calls } = await supabase
      .from('calls')
      .select('id, started_at, ended_at, duration_seconds, cost, status')
      .eq('astrologer_id', req.user.id)
      .eq('status', 'completed')
      .order('ended_at', { ascending: false })
      .limit(20);

    res.json({
      balance:      parseFloat(astrologer?.earnings_balance || 0),
      recent_calls: calls || [],
    });
  } catch (err) {
    next(err);
  }
});

// POST /astrologer/me/withdrawal — request payout
router.post('/me/withdrawal', auth, requireAstrologer, async (req, res, next) => {
  try {
    const { amount } = req.body;
    const parsedAmount = parseFloat(amount);

    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }

    const { data: astrologer } = await supabase
      .from('astrologers')
      .select('earnings_balance')
      .eq('id', req.user.id)
      .single();

    if (!astrologer) return res.status(404).json({ error: 'Astrologer not found' });
    if (parseFloat(astrologer.earnings_balance) < parsedAmount) {
      return res.status(400).json({ error: 'Insufficient earnings balance' });
    }

    const { data, error } = await supabase
      .from('withdrawal_requests')
      .insert({
        astrologer_id: req.user.id,
        amount:        parsedAmount,
        status:        'pending',
      })
      .select('id, amount, status, created_at')
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
