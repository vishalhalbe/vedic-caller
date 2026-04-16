const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('RefreshToken', {
    id:         { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    user_id:    { type: DataTypes.UUID, allowNull: false },
    token_hash: { type: DataTypes.TEXT, allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    revoked:    { type: DataTypes.BOOLEAN, defaultValue: false },
  }, {
    tableName: 'refresh_tokens',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });
};
