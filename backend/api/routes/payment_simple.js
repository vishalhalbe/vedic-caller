const express    = require('express');
const router     = express.Router();
const auth       = require('../middleware/authMiddleware');
const supabase   = require('../config/db');
const { verifyPayment }    = require('../services/paymentService');
const { atomicCredit }     = require('../services/walletEngine');
const { getRazorpayClient } = require('../services/razorpayClient');

router.post('/create-order', auth, async (req, res, next) => {
  try {
    const { amount } = req.body;
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return res.status(400).json({ error: 'Invalid amount' });

    let orderId;
    if (process.env.NODE_ENV !== 'production') {
      orderId = `order_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    } else {
      const rzp   = getRazorpayClient();
      const order = await rzp.orders.create({
        amount:   Math.round(parsed * 100),
        currency: 'INR',
        notes:    { user_id: req.user.id },
      });
      orderId = order.id;
    }

    const { error } = await supabase.from('orders').insert({
      id:      orderId,
      user_id: req.user.id,
      amount:  parsed,
      status:  'created',
    });
    if (error) throw new Error(error.message);

    res.json({ order_id: orderId, amount: Math.round(parsed * 100), currency: 'INR' });
  } catch (err) {
    next(err);
  }
});

router.post('/success', auth, async (req, res, next) => {
  try {
    const { order_id, payment_id, signature } = req.body;
    if (!order_id || !payment_id || !signature) {
      return res.status(400).json({ error: 'order_id, payment_id, and signature required' });
    }

    const valid = verifyPayment(order_id, payment_id, signature);
    if (!valid) return res.status(400).json({ error: 'Invalid payment signature' });

    const { data: order } = await supabase
      .from('orders')
      .select('id, amount, status')
      .eq('id', order_id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!order) return res.status(400).json({ error: 'Order not found' });

    if (order.status === 'paid') {
      const { data: user } = await supabase
        .from('users')
        .select('wallet_balance')
        .eq('id', req.user.id)
        .single();
      return res.json({ success: true, balance: parseFloat(user.wallet_balance) });
    }

    const storedAmount = parseFloat(order.amount);
    const result = await atomicCredit(req.user.id, storedAmount, payment_id);

    await supabase.from('orders').update({ status: 'paid' }).eq('id', order_id);

    res.json({ success: true, balance: result.balance });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
