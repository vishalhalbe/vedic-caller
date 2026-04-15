const sequelize = require('../config/db');
const { Transaction } = require('../models');

exports.atomicDeduct = async (userId, amount, reference) => {
  return await sequelize.transaction(async (t) => {
    // Pessimistic row-lock on the user row to prevent concurrent over-deductions
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
      type: 'debit',
      status: 'success',
      reference: ref,
    }, { transaction: t });

    return { remaining: parseFloat((balance - amount).toFixed(2)) };
  });
};

exports.atomicCredit = async (userId, amount, reference = '') => {
  return await sequelize.transaction(async (t) => {
    // Idempotency: if this reference was already processed, return current balance
    if (reference) {
      const existing = await Transaction.findOne({
        where: { reference },
        transaction: t,
      });
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
      type: 'credit',
      status: 'success',
      reference,
    }, { transaction: t });

    const [rows] = await sequelize.query(
      `SELECT wallet_balance FROM users WHERE id = :userId`,
      { replacements: { userId }, transaction: t, type: sequelize.QueryTypes.SELECT }
    );

    return { balance: parseFloat(rows.wallet_balance) };
  });
};
