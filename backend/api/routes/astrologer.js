const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json([
    { id:1, name:'Pt. Sharma', rate:35 },
    { id:2, name:'Jyotika Devi', rate:75 }
  ]);
});

module.exports = router;