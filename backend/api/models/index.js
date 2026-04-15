const sequelize = require('../config/db');

const User        = require('./user')(sequelize);
const Astrologer  = require('./astrologer')(sequelize);
const Call        = require('./call')(sequelize);
const Transaction = require('./transaction')(sequelize);

// Associations
User.hasMany(Transaction, { foreignKey: 'user_id' });
User.hasMany(Call,        { foreignKey: 'user_id' });
Astrologer.hasMany(Call,  { foreignKey: 'astrologer_id' });
Call.belongsTo(User,        { foreignKey: 'user_id' });
Call.belongsTo(Astrologer,  { foreignKey: 'astrologer_id' });
Transaction.belongsTo(User, { foreignKey: 'user_id' });

module.exports = { sequelize, User, Astrologer, Call, Transaction };
