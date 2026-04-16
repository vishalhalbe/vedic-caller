const express    = require('express');
const router     = express.Router();
const { Op }     = require('sequelize');
const { User, Astrologer, Call, Transaction } = require('../models');

// All routes here are already protected by authMiddleware + requireAdmin in app.js

// GET /admin/stats — platform overview
router.get('/stats', async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalAstrologers,
      onlineAstrologers,
      totalCalls,
      activeCalls,
      completedCalls,
    ] = await Promise.all([
      User.count(),
      Astrologer.count(),
      Astrologer.count({ where: { is_available: true } }),
      Call.count(),
      Call.count({ where: { status: 'active' } }),
      Call.count({ where: { status: 'completed' } }),
    ]);

    // Revenue: sum of completed call costs
    const revenueResult = await Call.findOne({
      attributes: [
        [require('../config/db').literal('COALESCE(SUM(cost), 0)'), 'total_revenue'],
      ],
      where: { status: 'completed' },
      raw: true,
    });

    res.json({
      users:      { total: totalUsers },
      astrologers: {
        total:   totalAstrologers,
        online:  onlineAstrologers,
      },
      calls: {
        total:     totalCalls,
        active:    activeCalls,
        completed: completedCalls,
      },
      revenue: {
        total_inr: parseFloat(revenueResult?.total_revenue ?? 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/astrologers — list all astrologers with earnings
router.get('/astrologers', async (req, res, next) => {
  try {
    const astrologers = await Astrologer.findAll({
      attributes: ['id', 'name', 'rate_per_minute', 'is_available', 'earnings_balance', 'specialization', 'experience_years'],
      order: [['name', 'ASC']],
    });
    res.json(astrologers);
  } catch (err) {
    next(err);
  }
});

// POST /admin/astrologers/:id/toggle — toggle astrologer availability
router.post('/astrologers/:id/toggle', async (req, res, next) => {
  try {
    const { available } = req.body;
    if (typeof available !== 'boolean') {
      return res.status(400).json({ error: 'available (boolean) required' });
    }
    const astrologer = await Astrologer.findByPk(req.params.id);
    if (!astrologer) return res.status(404).json({ error: 'Astrologer not found' });
    await astrologer.update({ is_available: available });
    res.json({ id: astrologer.id, is_available: available });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
