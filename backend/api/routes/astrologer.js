const express = require('express');
const router = express.Router();
const { Astrologer } = require('../models');

// GET /astrologer — list available astrologers
router.get('/', async (req, res, next) => {
  try {
    const astrologers = await Astrologer.findAll({
      where: { is_available: true },
      attributes: ['id', 'name', 'rate_per_minute', 'is_available'],
      order: [['name', 'ASC']],
    });
    res.json(astrologers);
  } catch (err) {
    next(err);
  }
});


module.exports = router;
