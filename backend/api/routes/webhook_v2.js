const express    = require('express');
const crypto     = require('crypto');
const router     = express.Router();
const supabase   = require('../config/db');
const { atomicCredit } = require('../services/walletEngine');

router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[webhook] RAZORPAY_WEBHOOK_SECRET not set — webhook not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    const signature = req.headers['x-razorpay-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing signature header' });

    const rawBody  = req.body;
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const sigBuf      = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const valid = sigBuf.length === expectedBuf.length &&
                  crypto.timingSafeEqual(sigBuf, expectedBuf);
    if (!valid) return res.status(400).json({ error: 'Invalid webhook signature' });

    const event = JSON.parse(rawBody);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const userId  = payment.notes?.user_id;
      const orderId = payment.order_id;

      if (!userId)  return res.status(400).json({ error: 'Missing user_id in payment notes' });
      if (!orderId) return res.status(400).json({ error: 'Missing order_id in payment' });

      const { data: order } = await supabase
        .from('orders')
        .select('id, amount, status, user_id')
        .eq('id', orderId)
        .maybeSingle();

      if (!order) {
        return res.status(400).json({ error: 'Order not found' });
      }

      // Use DB-authoritative user_id, not the attacker-controllable notes field
      if (order.user_id !== userId) {
        return res.status(400).json({ error: 'user_id mismatch' });
      }

      if (order.status === 'paid') {
        return res.json({ status: 'ok' });
      }

      // Atomically claim the order — only the first webhook fires the credit
      const { data: claimed } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', orderId)
        .eq('status', 'created')
        .select('id');

      if (!claimed || claimed.length === 0) {
        return res.json({ status: 'ok' });
      }

      const amountInr = parseFloat(order.amount);
      await atomicCredit(order.user_id, amountInr, payment.id);
    }

    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
