const supabase = require('../config/db');
const { atomicDeduct } = require('./walletEngine');
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

  const { data: calls, error } = await query;
  if (error) throw new Error(error.message);

  const call = calls && calls[0];
  if (!call) throw new Error('Active call not found');
  if (call.status !== 'active') throw new Error('Call already ended');

  const endedAt         = new Date();
  const durationSeconds = Math.floor((endedAt - new Date(call.started_at)) / 1000);

  return { call, durationSeconds, endedAt };
};

exports.finaliseCall = async (call, durationSeconds, endedAt) => {
  const cost = parseFloat(calculateDeduction(call.rate_per_minute, durationSeconds).toFixed(2));

  await atomicDeduct(call.user_id, cost, `call_end_${call.id}`);

  const { error: callErr } = await supabase
    .from('calls')
    .update({
      status:           'completed',
      ended_at:         endedAt.toISOString(),
      duration_seconds: durationSeconds,
      cost,
    })
    .eq('id', call.id);

  if (callErr) throw new Error(callErr.message);

  const { data: astrologer, error: aErr } = await supabase
    .from('astrologers')
    .select('earnings_balance')
    .eq('id', call.astrologer_id)
    .single();

  if (aErr) throw new Error(aErr.message);

  const { error: updateErr } = await supabase
    .from('astrologers')
    .update({
      is_available:     true,
      earnings_balance: parseFloat(astrologer.earnings_balance) + cost,
    })
    .eq('id', call.astrologer_id);

  if (updateErr) throw new Error(updateErr.message);

  return { duration: durationSeconds, cost };
};
