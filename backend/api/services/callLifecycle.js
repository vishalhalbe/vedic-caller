const sequelize = require('../config/db');
const { Call, Astrologer } = require('../models');
const { atomicDeduct } = require('./walletEngine');

exports.startCall = async (userId, astrologerId, rate) => {
  return await sequelize.transaction(async (t) => {
    // Lock astrologer row — prevents two concurrent calls from both passing availability check
    const [rows] = await sequelize.query(
      `SELECT id, is_available FROM astrologers WHERE id = :id FOR UPDATE`,
      { replacements: { id: astrologerId }, transaction: t, type: sequelize.QueryTypes.SELECT }
    );

    if (!rows) throw new Error('Astrologer not found');
    if (!rows.is_available) throw new Error('Astrologer is not available');

    // Mark astrologer busy for the duration of the call
    await Astrologer.update(
      { is_available: false },
      { where: { id: astrologerId }, transaction: t }
    );

    const call = await Call.create({
      user_id:          userId,
      astrologer_id:    astrologerId,
      status:           'active',
      started_at:       new Date(),
      cost:             0,
      duration_seconds: 0,
      rate_per_minute:  rate,   // stored server-side — client cannot manipulate billing
    }, { transaction: t });

    return {
      call_id:      call.id,
      userId,
      astrologerId,
      rate,
      startTime:    call.started_at.getTime(),
      status:       'active',
    };
  });
};

exports.endCall = async (userId, callId) => {
  const call = await Call.findOne({
    where: callId
      ? { id: callId, user_id: userId }
      : { user_id: userId, status: 'active' },
  });

  if (!call) throw new Error('Active call not found');
  if (call.status !== 'active') throw new Error('Call already ended');

  const endedAt         = new Date();
  const durationSeconds = Math.floor((endedAt - call.started_at) / 1000);

  return { call, durationSeconds, endedAt };
};

exports.finaliseCall = async (call, durationSeconds, endedAt) => {
  // Rate is read from the stored call record — client cannot influence billing
  const cost = parseFloat(((call.rate_per_minute / 60) * durationSeconds).toFixed(2));

  // Reference tied to call.id so a retried /call/end cannot double-deduct.
  // The UNIQUE constraint on transactions.reference blocks the second deduction.
  await atomicDeduct(call.user_id, cost, `call_end_${call.id}`);

  await call.update({
    status:           'completed',
    ended_at:         endedAt,
    duration_seconds: durationSeconds,
    cost,
  });

  // Credit the astrologer's earnings and restore availability
  await Astrologer.update(
    {
      is_available:      true,
      earnings_balance:  sequelize.literal(`earnings_balance + ${cost}`),
    },
    { where: { id: call.astrologer_id } }
  );

  return { duration: durationSeconds, cost };
};
