const supabase = require('../config/db');
const { calculateDeduction } = require('./walletService');

exports.startCall = async (userId, astrologerId, rate) => {
  const { data, error } = await supabase.rpc('start_call', {
    p_user_id:       userId,
    p_astrologer_id: astrologerId,
    p_rate:          rate,
  });

  if (error) {
    if (error.message.includes('not available')) throw new Error('Astrologer is not available');
    if (error.message.includes('not found'))     throw new Error('Astrologer not found');
    throw new Error(error.message);
  }

  return {
    call_id:     data.call_id,
    userId,
    astrologerId,
    rate,
    startTime:   new Date(data.started_at).getTime(),
    status:      'active',
  };
};

exports.endCall = async (userId, callId) => {
  let query = supabase.from('calls').select('*').eq('user_id', userId);

  if (callId) {
    query = query.eq('id', callId);
  } else {
    query = query.eq('status', 'active');
  }

  const { data: calls, error } = await query.limit(1);
  if (error) throw new Error(error.message);

  const call = calls && calls[0];
  if (!call) throw new Error('Active call not found');
  if (call.status !== 'active') throw new Error('Call already ended');

  const endedAt         = new Date();
  const durationSeconds = Math.floor((endedAt - new Date(call.started_at)) / 1000);

  return { call, durationSeconds, endedAt };
};

exports.finaliseCall = async (call, durationSeconds) => {
  const cost      = parseFloat(calculateDeduction(call.rate_per_minute, durationSeconds).toFixed(2));
  const reference = `call_end_${call.id}`;

  const { data, error } = await supabase.rpc('end_call', {
    p_call_id:       call.id,
    p_duration_secs: durationSeconds,
    p_cost:          cost,
    p_reference:     reference,
  });

  if (error) {
    if (error.message.includes('Insufficient balance')) throw new Error('Insufficient balance');
    if (error.message.includes('Call already ended'))   throw new Error('Call already ended');
    throw new Error(error.message);
  }

  return { duration: data.duration, cost: parseFloat(data.cost) };
};
