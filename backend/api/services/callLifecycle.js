const sequelize = require('../config/db');
const { Call, Astrologer } = require('../models');
const { atomicDeduct } = require('./walletEngine');
const { calculateDeduction } = require('./walletService'); // single source of truth for billing

exports.startCall = async (userId, astrologerId, rate) => {
  return await sequelize.transaction(async (t) => {
    // Lock astrologer row — prevents two concurrent calls from both passing availability check
    const [rows] = await sequelize.query(
      `SELECT id, is_available FROM astrologers WHERE id = :id FOR UPDATE`,
      { replacements: { id: astrologerId }, transaction: t, type: sequelize.QueryTypes.SELECT }
    );

    if (!rows) throw new Error('Astrologer not found');
    if (!rows.is_available) throw new Error('Astrologer is not available');

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
      rate_per_minute:  rate,
    }, { transaction: t });

    return {
      call_id:   call.id,
      userId,
      astrologerId,
      rate,
      startTime: call.started_at.getTime(),
      status:    'active',
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
  // Single transaction wraps deduction + call update + astrologer update.
  // If any step fails the entire operation rolls back — user is never charged
  // without the call being marked completed.
  return await sequelize.transaction(async (t) => {
    // calculateDeduction is the single source of truth for the billing formula.
    const cost = parseFloat(calculateDeduction(call.rate_per_minute, durationSeconds).toFixed(2));

    // Reference tied to call.id — retried /call/end cannot double-deduct.
    await atomicDeduct(call.user_id, cost, `call_end_${call.id}`, t);

    await call.update({
      status:           'completed',
      ended_at:         endedAt,
      duration_seconds: durationSeconds,
      cost,
    }, { transaction: t });

    await Astrologer.update(
      {
        is_available:     true,
        earnings_balance: sequelize.literal(`earnings_balance + ${cost}`),
      },
      { where: { id: call.astrologer_id }, transaction: t }
    );

    return { duration: durationSeconds, cost };
  });
};
