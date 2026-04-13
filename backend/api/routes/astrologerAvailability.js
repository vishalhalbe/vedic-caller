const express = require('express');
const router = express.Router();

let availability = {};

router.post('/toggle', (req,res)=>{
  const { astrologer_id, available } = req.body;
  availability[astrologer_id] = available;
  res.json({success:true});
});

router.get('/:id', (req,res)=>{
  res.json({available: availability[req.params.id] || false});
});

module.exports = router;