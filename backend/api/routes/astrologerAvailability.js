const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/authMiddleware');
const supabase   = require('../config/db');

router.post('/toggle', auth, requireAdmin, async (req, res, next) => {
  try {
    const { astrologer_id, available } = req.body;
    if (!astrologer_id || available === undefined) {
      return res.status(400).json({ error: 'astrologer_id and available required' });
    }

    const { data, error } = await supabase
      .from('astrologers')
      .update({ is_available: available })
      .eq('id', astrologer_id)
      .select('id')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Astrologer not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { data: astrologer, error } = await supabase
      .from('astrologers')
      .select('id, is_available')
      .eq('id', req.params.id)
      .single();

    if (error || !astrologer) return res.status(404).json({ error: 'Astrologer not found' });
    res.json({ available: astrologer.is_available });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
