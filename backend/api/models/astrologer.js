const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Astrologer', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    rate_per_minute: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 50 },
    is_available: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    tableName: 'astrologers',
    underscored: true,
    timestamps: true,
  });
};
