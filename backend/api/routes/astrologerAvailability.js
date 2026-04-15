const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/authMiddleware');
const { Astrologer } = require('../models');

// POST /availability/toggle — set astrologer availability (admin only)
router.post('/toggle', auth, requireAdmin, async (req, res, next) => {
  try {
    const { astrologer_id, available } = req.body;
    if (!astrologer_id || available === undefined) {
      return res.status(400).json({ error: 'astrologer_id and available required' });
    }
    const [updated] = await Astrologer.update(
      { is_available: available },
      { where: { id: astrologer_id } }
    );
    if (!updated) return res.status(404).json({ error: 'Astrologer not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /availability/:id — check single astrologer availability
router.get('/:id', async (req, res, next) => {
  try {
    const astrologer = await Astrologer.findByPk(req.params.id, {
      attributes: ['id', 'is_available'],
    });
    if (!astrologer) return res.status(404).json({ error: 'Astrologer not found' });
    res.json({ available: astrologer.is_available });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
