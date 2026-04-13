const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Transaction', {
    user_id: DataTypes.INTEGER,
    amount: DataTypes.FLOAT,
    type: DataTypes.STRING, // debit/credit
    status: DataTypes.STRING,
    reference: DataTypes.STRING
  });
};