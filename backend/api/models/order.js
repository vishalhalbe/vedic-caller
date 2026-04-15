const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Order', {
    id:       { type: DataTypes.TEXT, primaryKey: true },
    user_id:  { type: DataTypes.UUID, allowNull: false },
    amount:   { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    currency: { type: DataTypes.STRING, defaultValue: 'INR' },
    status:   { type: DataTypes.STRING, defaultValue: 'created' },
  }, {
    tableName:  'orders',
    underscored: true,
    timestamps:  true,
    createdAt:   'created_at',
    updatedAt:   false,
  });
};
