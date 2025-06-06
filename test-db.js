const { db } = require('./db');
db.raw('SELECT 1').then(() => console.log('Connection successful')).catch(err => console.error('Connection failed:', err));
