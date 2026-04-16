const sequelize = require('../config/db');
const { Transaction } = require('../models');

// atomicDeduct accepts an optional outer transaction (t).
// When called from finaliseCall, the caller owns the transaction so all
// wallet + call + astrologer ops commit or roll back together.
exports.atomicDeduct = async (userId, amount, reference, outerT = null) => {
  const execute = async (t) => {
    const [rows] = await sequelize.query(
      `SELECT wallet_balance FROM users WHERE id = :userId FOR UPDATE`,
      { replacements: { userId }, transaction: t, type: sequelize.QueryTypes.SELECT }
    );

    if (!rows) throw new Error('User not found');

    const balance = parseFloat(rows.wallet_balance);
    if (balance < amount) throw new Error('Insufficient balance');

    await sequelize.query(
      `UPDATE users SET wallet_balance = wallet_balance - :amount WHERE id = :userId`,
      { replacements: { amount, userId }, transaction: t }
    );

    const ref = reference || `debit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await Transaction.create({
      user_id: userId,
      amount,
      type:    'debit',
      status:  'success',
      reference: ref,
    }, { transaction: t });

    return { remaining: parseFloat((balance - amount).toFixed(2)) };
  };

  // Re-use caller's transaction if supplied; otherwise start a new one.
  return outerT ? execute(outerT) : sequelize.transaction(execute);
};

exports.atomicCredit = async (userId, amount, reference = '') => {
  try {
    return await sequelize.transaction(async (t) => {
      if (reference) {
        const existing = await Transaction.findOne({ where: { reference }, transaction: t });
        if (existing) {
          const [rows] = await sequelize.query(
            `SELECT wallet_balance FROM users WHERE id = :userId`,
            { replacements: { userId }, transaction: t, type: sequelize.QueryTypes.SELECT }
          );
          return { balance: parseFloat(rows.wallet_balance), idempotent: true };
        }
      }

      await sequelize.query(
        `UPDATE users SET wallet_balance = wallet_balance + :amount WHERE id = :userId`,
        { replacements: { amount, userId }, transaction: t }
      );

      await Transaction.create({
        user_id: userId,
        amount,
        type:    'credit',
        status:  'success',
        reference,
      }, { transaction: t });

      const [rows] = await sequelize.query(
        `SELECT wallet_balance FROM users WHERE id = :userId`,
        { replacements: { userId }, transaction: t, type: sequelize.QueryTypes.SELECT }
      );
      return { balance: parseFloat(rows.wallet_balance) };
    });
  } catch (err) {
    // Two concurrent requests both passed the idempotency SELECT before either
    // committed — unique constraint catches the second INSERT.
    // Treat this as a successful idempotent delivery.
    if (err.name === 'SequelizeUniqueConstraintError' && reference) {
      const [rows] = await sequelize.query(
        `SELECT wallet_balance FROM users WHERE id = :userId`,
        { replacements: { userId }, type: sequelize.QueryTypes.SELECT }
      );
      return { balance: parseFloat(rows?.wallet_balance ?? 0), idempotent: true };
    }
    throw err;
  }
};
