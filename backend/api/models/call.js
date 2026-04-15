const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Call', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    astrologer_id: { type: DataTypes.UUID, allowNull: false },
    duration_seconds: { type: DataTypes.INTEGER, defaultValue: 0 },
    cost: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    rate_per_minute: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    started_at: { type: DataTypes.DATE },
    ended_at: { type: DataTypes.DATE },
  }, {
    tableName: 'calls',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  });
};
