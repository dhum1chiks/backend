require('dotenv').config({ path: '.env', silent: true });
const knex = require('knex');

const db = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PG_SSL_CA
      ? {
      
          rejectUnauthorized: false
          ca: process.env.PG_SSL_CA,
        }
      : false, // Disable SSL if PG_SSL_CA is not set
  },
  pool: { min: 0, max: 3 }, // Further reduce max connections
  acquireConnectionTimeout: 10000,
  migrations: { directory: './migrations' },
  debug: process.env.NODE_ENV !== 'production',
});

db.raw('SELECT 1')
  .then(() => console.log('Database connected successfully'))
  .catch((err) => console.error('Database connection error:', err));

module.exports = { db };
