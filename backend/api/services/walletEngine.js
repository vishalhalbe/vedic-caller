const supabase = require('../config/db');

// atomicDeduct — calls a PostgreSQL RPC that does:
//   SELECT wallet_balance FROM users WHERE id = userId FOR UPDATE
//   UPDATE users SET wallet_balance = wallet_balance - amount WHERE id = userId
//   INSERT INTO transactions (user_id, amount, type, status, reference)
// Returns { remaining } or throws on insufficient balance.
exports.atomicDeduct = async (userId, amount, reference) => {
  const ref = reference || `debit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const { data, error } = await supabase.rpc('wallet_deduct', {
    p_user_id:   userId,
    p_amount:    amount,
    p_reference: ref,
  });

  if (error) {
    if (error.message.includes('Insufficient balance')) throw new Error('Insufficient balance');
    if (error.message.includes('User not found'))       throw new Error('User not found');
    throw new Error(error.message);
  }

  return { remaining: parseFloat(data) };
};

// atomicCredit — calls a PostgreSQL RPC that does:
//   idempotency check on reference
//   UPDATE users SET wallet_balance = wallet_balance + amount WHERE id = userId
//   INSERT INTO transactions (user_id, amount, type, status, reference)
// Returns { balance, idempotent? }
exports.atomicCredit = async (userId, amount, reference = '') => {
  const { data, error } = await supabase.rpc('wallet_credit', {
    p_user_id:   userId,
    p_amount:    amount,
    p_reference: reference,
  });

  if (error) throw new Error(error.message);

  return {
    balance:    parseFloat(data.balance),
    idempotent: data.idempotent || false,
  };
};
