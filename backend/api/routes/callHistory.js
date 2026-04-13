const express = require('express');
const router = express.Router();

let history = []; // temp store

router.post('/add', (req,res)=>{
  history.push(req.body);
  res.json({success:true});
});

router.get('/:userId', (req,res)=>{
  const data = history.filter(h=>h.user_id==req.params.userId);
  res.json(data);
});

module.exports = router;