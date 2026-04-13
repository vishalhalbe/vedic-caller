const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('User', {
    phone: DataTypes.STRING,
    name: DataTypes.STRING,
    wallet: { type: DataTypes.FLOAT, defaultValue: 0 }
  });
};