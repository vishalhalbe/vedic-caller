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
