const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email:         { type: DataTypes.STRING, unique: true, allowNull: true },
    password_hash: { type: DataTypes.STRING, allowNull: true },
    phone:         { type: DataTypes.STRING, unique: true, allowNull: true },
    name:          { type: DataTypes.STRING, defaultValue: '' },
    wallet_balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
  });
};
