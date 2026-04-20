const express    = require('express');
const router     = express.Router();
const supabase   = require('../config/db');

// All routes here are already protected by authMiddleware + requireAdmin in app.js

router.get('/stats', async (req, res, next) => {
  try {
    const [
      { count: totalUsers },
      { count: totalAstrologers },
      { count: onlineAstrologers },
      { count: totalCalls },
      { count: activeCalls },
      { count: completedCalls },
      { data: revenueRows },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('astrologers').select('*', { count: 'exact', head: true }),
      supabase.from('astrologers').select('*', { count: 'exact', head: true }).eq('is_available', true),
      supabase.from('calls').select('*', { count: 'exact', head: true }),
      supabase.from('calls').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('calls').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('calls').select('cost').eq('status', 'completed'),
    ]);

    const totalRevenue = (revenueRows || []).reduce((sum, r) => sum + parseFloat(r.cost || 0), 0);

    res.json({
      users:       { total: totalUsers || 0 },
      astrologers: { total: totalAstrologers || 0, online: onlineAstrologers || 0 },
      calls:       { total: totalCalls || 0, active: activeCalls || 0, completed: completedCalls || 0 },
      revenue:     { total_inr: parseFloat(totalRevenue.toFixed(2)) },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/astrologers', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('astrologers')
      .select('id, name, rate_per_minute, is_available, earnings_balance, specialization, experience_years')
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

// ── Withdrawal management ──────────────────────────────────────────────────────

router.get('/withdrawals', async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('id, astrologer_id, amount, status, created_at, updated_at, astrologers(name, email)')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) {
    next(err);
  }
});

router.post('/withdrawals/:id/approve', async (req, res, next) => {
  try {
    const { data: wr, error: fetchErr } = await supabase
      .from('withdrawal_requests')
      .select('id, astrologer_id, amount, status')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !wr) return res.status(404).json({ error: 'Withdrawal request not found' });
    if (wr.status !== 'pending') {
      return res.status(400).json({ error: `Cannot approve a ${wr.status} request` });
    }

    // Atomically deduct from astrologer earnings via RPC (prevents race conditions)
    const { error: rpcErr } = await supabase.rpc('astrologer_earnings_deduct', {
      p_astrologer_id: wr.astrologer_id,
      p_amount:        wr.amount,
    });

    if (rpcErr) {
      if (rpcErr.message.includes('Insufficient')) {
        return res.status(400).json({ error: 'Astrologer has insufficient earnings balance' });
      }
      throw new Error(rpcErr.message);
    }

    const { data: updated, error: updateErr } = await supabase
      .from('withdrawal_requests')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, amount, status, updated_at')
      .single();

    if (updateErr) throw new Error(updateErr.message);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/withdrawals/:id/reject', async (req, res, next) => {
  try {
    const { data: wr, error: fetchErr } = await supabase
      .from('withdrawal_requests')
      .select('id, status')
      .eq('id', req.params.id)
      .single();

    if (fetchErr || !wr) return res.status(404).json({ error: 'Withdrawal request not found' });
    if (wr.status !== 'pending') {
      return res.status(400).json({ error: `Cannot reject a ${wr.status} request` });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('withdrawal_requests')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('id, amount, status, updated_at')
      .single();

    if (updateErr) throw new Error(updateErr.message);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/astrologers/:id/toggle', async (req, res, next) => {
  try {
    const { available } = req.body;
    if (typeof available !== 'boolean') {
      return res.status(400).json({ error: 'available (boolean) required' });
    }

    const { data, error } = await supabase
      .from('astrologers')
      .update({ is_available: available })
      .eq('id', req.params.id)
      .select('id, is_available')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Astrologer not found' });
    res.json({ id: data.id, is_available: available });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
