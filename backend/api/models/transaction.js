const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Transaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'credit' },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'success' },
    reference: { type: DataTypes.STRING, defaultValue: '' },
  }, {
    tableName: 'transactions',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  });
};
