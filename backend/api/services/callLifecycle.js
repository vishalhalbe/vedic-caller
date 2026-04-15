const { Call } = require('../models');
const { atomicDeduct } = require('./walletEngine');

exports.startCall = async (userId, astrologerId, rate) => {
  const call = await Call.create({
    user_id: userId,
    astrologer_id: astrologerId,
    status: 'active',
    started_at: new Date(),
    cost: 0,
    duration_seconds: 0,
  });

  return {
    call_id: call.id,
    userId,
    astrologerId,
    rate,
    startTime: call.started_at.getTime(),
    status: 'active',
  };
};

exports.endCall = async (userId, callId) => {
  const call = await Call.findOne({
    where: callId ? { id: callId, user_id: userId } : { user_id: userId, status: 'active' },
  });

  if (!call) throw new Error('Active call not found');
  if (call.status !== 'active') throw new Error('Call already ended');

  const endedAt = new Date();
  const durationSeconds = Math.floor((endedAt - call.started_at) / 1000);

  // Rate is stored per minute — cost is pro-rated per second server-side
  // Rate must be passed in the request body since call record doesn't store it yet
  return { call, durationSeconds, endedAt };
};

exports.finaliseCall = async (call, rate, durationSeconds, endedAt) => {
  const cost = parseFloat(((rate / 60) * durationSeconds).toFixed(2));

  await atomicDeduct(call.user_id, cost);

  await call.update({
    status: 'completed',
    ended_at: endedAt,
    duration_seconds: durationSeconds,
    cost,
  });

  return { duration: durationSeconds, cost };
};
