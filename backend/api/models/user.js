const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    phone: { type: DataTypes.STRING, unique: true, allowNull: false },
    name: { type: DataTypes.STRING, defaultValue: '' },
    wallet_balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
  });
};
