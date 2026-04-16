const express    = require('express');
const router     = express.Router();
const { Op }     = require('sequelize');
const auth       = require('../middleware/authMiddleware');
const { startCall, endCall, finaliseCall } = require('../services/callLifecycle');
const { User, Call, Astrologer } = require('../models');

// Agora token generation — requires AGORA_APP_ID + AGORA_APP_CERTIFICATE env vars
function buildAgoraToken(channelName, uid) {
  const appId   = process.env.AGORA_APP_ID;
  const appCert = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCert) {
    // Dev fallback — not for production
    console.warn('[call] AGORA_APP_ID/AGORA_APP_CERTIFICATE not set; using dev placeholder');
    return { channel: channelName, token: `dev-token-${channelName}` };
  }

  try {
    const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
    const expireAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const token = RtcTokenBuilder.buildTokenWithUid(appId, appCert, channelName, uid, RtcRole.PUBLISHER, expireAt);
    return { channel: channelName, token };
  } catch (e) {
    console.error('[call] Agora token build failed:', e.message);
    throw new Error('Failed to generate call token');
  }
}

// POST /call/start
router.post('/start', auth, async (req, res, next) => {
  try {
    const { astrologer_id } = req.body;
    if (!astrologer_id) {
      return res.status(400).json({ error: 'astrologer_id required' });
    }

    // Rate is always read from the DB — never trusted from the client
    const astrologer = await Astrologer.findByPk(astrologer_id, {
      attributes: ['id', 'rate_per_minute', 'is_available'],
    });
    if (!astrologer) return res.status(404).json({ error: 'Astrologer not found' });
    // Fast pre-check for UX — startCall also checks atomically inside a DB transaction
    if (!astrologer.is_available) return res.status(400).json({ error: 'Astrologer is not available' });

    const parsedRate = parseFloat(astrologer.rate_per_minute);

    // Check user has funds before starting
    const user = await User.findByPk(req.user.id, { attributes: ['wallet_balance'] });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (parseFloat(user.wallet_balance) < parsedRate / 60) {
      return res.status(400).json({ error: 'Insufficient balance to start call' });
    }

    const session = await startCall(req.user.id, astrologer_id, parsedRate);
    const channelName = `jc_${req.user.id}_${Date.now()}`;
    const { channel, token } = buildAgoraToken(channelName, 0);

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

// POST /call/end
router.post('/end', auth, async (req, res, next) => {
  try {
    const { call_id } = req.body;
    // Rate is NOT taken from the client — it was stored server-side at call start
    const { call, durationSeconds, endedAt } = await endCall(req.user.id, call_id);
    const result = await finaliseCall(call, durationSeconds, endedAt);

    res.json(result);
  } catch (err) {
    if (err.message === 'Active call not found' || err.message === 'Call already ended') {
      return res.status(400).json({ error: err.message });
    }
    if (err.message === 'Insufficient balance') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// POST /call/cleanup — cron-only endpoint to close stale calls and restore astrologer availability
// Auth: x-cleanup-secret header   Frequency: every 5 minutes via cron
router.post('/cleanup', async (req, res, next) => {
  try {
    const secret = req.headers['x-cleanup-secret'];
    const expected = process.env.CLEANUP_SECRET;
    if (!expected || secret !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Find stale active calls before cancelling so we can restore astrologer availability
    const staleCalls = await Call.findAll({
      where: { status: 'active', started_at: { [Op.lt]: oneHourAgo } },
      attributes: ['id', 'astrologer_id'],
    });

    if (staleCalls.length > 0) {
      const staleIds         = staleCalls.map(c => c.id);
      const staleAstrologers = [...new Set(staleCalls.map(c => c.astrologer_id))];

      await Call.update(
        { status: 'cancelled' },
        { where: { id: { [Op.in]: staleIds } } }
      );

      // Restore availability only for astrologers with NO remaining active calls.
      // An astrologer could have a second, non-stale active call started after the stale one.
      const stillBusy = await Call.findAll({
        where:      { astrologer_id: { [Op.in]: staleAstrologers }, status: 'active' },
        attributes: ['astrologer_id'],
        raw:        true,
      });
      const busyIds = new Set(stillBusy.map(c => c.astrologer_id));
      const toFree  = staleAstrologers.filter(id => !busyIds.has(id));

      if (toFree.length > 0) {
        await Astrologer.update(
          { is_available: true },
          { where: { id: { [Op.in]: toFree } } }
        );
      }
    }

    res.json({ cleaned: staleCalls.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
