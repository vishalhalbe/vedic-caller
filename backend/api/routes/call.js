const express    = require('express');
const crypto     = require('crypto');
const router     = express.Router();
const auth       = require('../middleware/authMiddleware');
const supabase   = require('../config/db');
const { startCall, endCall, finaliseCall } = require('../services/callLifecycle');
const { requireAstrologer } = require('../middleware/authMiddleware');

function buildAgoraToken(channelName, uid) {
  const appId   = process.env.AGORA_APP_ID;
  const appCert = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCert) {
    console.warn('[call] AGORA_APP_ID/AGORA_APP_CERTIFICATE not set; using dev placeholder');
    return { channel: channelName, token: `dev-token-${channelName}` };
  }

  try {
    const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
    const expireAt = Math.floor(Date.now() / 1000) + 3600;
    const token = RtcTokenBuilder.buildTokenWithUid(appId, appCert, channelName, uid, RtcRole.PUBLISHER, expireAt);
    return { channel: channelName, token };
  } catch (e) {
    console.error('[call] Agora token build failed:', e.message);
    throw new Error('Failed to generate call token');
  }
}

router.post('/start', auth, async (req, res, next) => {
  try {
    const { astrologer_id } = req.body;
    if (!astrologer_id) return res.status(400).json({ error: 'astrologer_id required' });

    const { data: astrologer } = await supabase
      .from('astrologers')
      .select('id, rate_per_minute, is_available')
      .eq('id', astrologer_id)
      .single();

    if (!astrologer) return res.status(404).json({ error: 'Astrologer not found' });
    if (!astrologer.is_available) return res.status(400).json({ error: 'Astrologer is not available' });

    const parsedRate = parseFloat(astrologer.rate_per_minute);

    const { data: user } = await supabase
      .from('users')
      .select('wallet_balance')
      .eq('id', req.user.id)
      .single();

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (parseFloat(user.wallet_balance) < parsedRate / 60) {
      return res.status(400).json({ error: 'Insufficient balance to start call' });
    }

    const session = await startCall(req.user.id, astrologer_id, parsedRate);
    const channelName = `jc_${req.user.id}_${Date.now()}`;
    const { channel, token } = buildAgoraToken(channelName, 0);

    // Persist channel + token so astrologer can retrieve them on accept
    await supabase
      .from('calls')
      .update({ channel, agora_token: token })
      .eq('id', session.call_id);

    res.json({
      call_id:    session.call_id,
      channel,
      token,
      started_at: session.startTime,
    });
  } catch (err) {
    if (err.message === 'Astrologer is not available') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/end', auth, async (req, res, next) => {
  try {
    const { call_id } = req.body;
    const { call, durationSeconds } = await endCall(req.user.id, call_id);
    const result = await finaliseCall(call, durationSeconds);
    res.json(result);
  } catch (err) {
    if (['Active call not found', 'Call already ended', 'Insufficient balance'].includes(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// GET /call/incoming — astrologer polls for an active call directed at them
router.get('/incoming', auth, requireAstrologer, async (req, res, next) => {
  try {
    const { data: call } = await supabase
      .from('calls')
      .select('id, user_id, started_at, rate_per_minute, channel, agora_token')
      .eq('astrologer_id', req.user.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!call) return res.json({ call: null });

    // Attach seeker name for display
    const { data: seeker } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', call.user_id)
      .maybeSingle();

    res.json({
      call: {
        ...call,
        seeker_name: seeker?.name || seeker?.email || 'Seeker',
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /call/decline/:call_id — astrologer declines incoming call
router.post('/decline/:call_id', auth, requireAstrologer, async (req, res, next) => {
  try {
    const { call_id } = req.params;

    const { data: call } = await supabase
      .from('calls')
      .select('id, astrologer_id, status')
      .eq('id', call_id)
      .eq('astrologer_id', req.user.id)
      .maybeSingle();

    if (!call) return res.status(404).json({ error: 'Call not found' });
    if (call.status !== 'active') return res.status(400).json({ error: 'Call already ended' });

    await supabase
      .from('calls')
      .update({ status: 'cancelled', ended_at: new Date().toISOString() })
      .eq('id', call_id);

    await supabase
      .from('astrologers')
      .update({ is_available: true })
      .eq('id', req.user.id);

    res.json({ status: 'declined' });
  } catch (err) {
    next(err);
  }
});

router.post('/cleanup', async (req, res, next) => {
  try {
    const secret   = req.headers['x-cleanup-secret'];
    const expected = process.env.CLEANUP_SECRET;
    if (!expected || !secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const secBuf = Buffer.from(secret);
    const expBuf = Buffer.from(expected);
    if (secBuf.length !== expBuf.length || !crypto.timingSafeEqual(secBuf, expBuf)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: staleCalls } = await supabase
      .from('calls')
      .select('id, astrologer_id')
      .eq('status', 'active')
      .lt('started_at', oneHourAgo);

    if (staleCalls && staleCalls.length > 0) {
      const staleIds         = staleCalls.map(c => c.id);
      const staleAstrologers = [...new Set(staleCalls.map(c => c.astrologer_id))];

      await supabase.from('calls').update({ status: 'cancelled' }).in('id', staleIds);

      const { data: stillBusy } = await supabase
        .from('calls')
        .select('astrologer_id')
        .in('astrologer_id', staleAstrologers)
        .eq('status', 'active');

      const busyIds = new Set((stillBusy || []).map(c => c.astrologer_id));
      const toFree  = staleAstrologers.filter(id => !busyIds.has(id));

      if (toFree.length > 0) {
        await supabase.from('astrologers').update({ is_available: true }).in('id', toFree);
      }
    }

    res.json({ cleaned: staleCalls ? staleCalls.length : 0 });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
