const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Call', {
    user_id: DataTypes.INTEGER,
    astrologer_id: DataTypes.INTEGER,
    duration: DataTypes.INTEGER,
    cost: DataTypes.FLOAT,
    status: DataTypes.STRING
  });
};