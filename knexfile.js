// knexfile.js
module.exports = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL || 'postgres://taskmanager_user:0318@localhost:5432/taskmanager',
    migrations: {
      directory: './migrations'
    }
  }
};

