require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const PGSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const { db } = require('./db');
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const taskRoutes = require('./routes/tasks');
const usersRouter = require('./routes/users');
const rateLimit = require('express-rate-limit');

// ✅ Validate required env variables
['DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET'].forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Missing env variable: ${key}`);
    process.exit(1);
  }
});

// ✅ PostgreSQL session pool
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.PG_SSL_CA,
  },
});

const app = express();
app.set('trust proxy', 1); // Trust proxy for secure cookies in production

// ✅ Middlewares
app.use(express.json());
app.use(
  cors({
    origin: ['https://frontend-alpha-seven-16.vercel.app'],
    credentials: true,
  })
);
app.use(
  session({
    store: new PGSession({
      pool: pgPool,
      tableName: 'session',
      createTableIfMissing: false, // Make sure session table exists
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ✅ Health check & debug
app.get('/hello', (req, res) => res.send('Hello, World!'));
app.get('/env-check', (req, res) => {
  res.json({
    DATABASE_URL: !!process.env.DATABASE_URL,
    PG_SSL_CA: !!process.env.PG_SSL_CA,
    JWT_SECRET: !!process.env.JWT_SECRET,
    SESSION_SECRET: !!process.env.SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  });
});
app.get('/db-test', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'Database connection successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/', (req, res) => res.send('API Root'));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());

// ✅ Routes
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), authRoutes);
app.use('/teams', teamRoutes);
app.use('/tasks', taskRoutes);
app.use('/users', usersRouter);

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ✅ Confirm DB on startup
db.raw('SELECT 1')
  .then(() => console.log('✅ Database connected'))
  .catch((err) => console.error('❌ Database connection failed:', err));

module.exports = app;

