const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_URI || 'postgres://localhost:5432/jyotish');

module.exports = sequelize;