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
    earnings_balance:  { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    bio:               { type: DataTypes.TEXT },
    specialization:    { type: DataTypes.STRING },
    experience_years:  { type: DataTypes.INTEGER },
    photo_url:         { type: DataTypes.STRING(500) },
  }, {
    tableName: 'astrologers',
    underscored: true,
    timestamps: true,
  });
};
