const sequelize = require('../config/db');
const { Transaction } = require('../models');

exports.atomicDeduct = async (userId, amount) => {
  return await sequelize.transaction(async (t) => {
    const wallet = await sequelize.query(
      `SELECT balance FROM wallets WHERE user_id = :userId FOR UPDATE`,
      { replacements: { userId }, transaction: t }
    );

    const balance = wallet[0][0].balance;

    if (balance < amount) throw new Error('Insufficient balance');

    await sequelize.query(
      `UPDATE wallets SET balance = balance - :amount WHERE user_id = :userId`,
      { replacements: { amount, userId }, transaction: t }
    );

    await Transaction.create({
      user_id: userId,
      amount,
      type: 'debit',
      status: 'success'
    }, { transaction: t });

    return true;
  });
};