// db.js
require('dotenv').config();
const knex = require('knex');
const config = require('./knexfile');

console.log('Knex Config:', config.development); // Optional for debug
const db = knex(config.development);

db.raw('SELECT 1')
  .then(() => console.log('Database connected successfully'))
  .catch((err) => console.error('Database connection error:', err));

module.exports = { db };

