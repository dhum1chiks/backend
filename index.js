const result = require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const PGSession = require('connect-pg-simple')(session);
const { Pool } = require('pg'); // ✅ Import pg.Pool
const { db } = require('./db');
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const taskRoutes = require('./routes/tasks');
const usersRouter = require('./routes/users');
const rateLimit = require('express-rate-limit');

// Check for environment variables
if (result.error) {
  console.error('Error loading .env file:', result.error.message);
}
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set');
}
if (!process.env.JWT_SECRET) {
  console.error('Error: JWT_SECRET is not set');
}
if (!process.env.SESSION_SECRET) {
  console.error('Error: SESSION_SECRET is not set');
}

// ✅ Create a pg.Pool instance for the session store
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.PG_SSL_CA
  }
});

const app = express();
app.set('trust proxy', 1); // Enable trust proxy for rate limiting behind Vercel/Proxies
app.use(express.json());

// ✅ Session configuration using connect-pg-simple with pg.Pool
app.use(
  session({
    store: new PGSession({
      pool: pgPool,
      tableName: 'session',
      createTableIfMissing: false
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(
  cors({
    origin: ['https://frontend-alpha-seven-16.vercel.app'],
    credentials: true,
  })
);

// Rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/auth', authLimiter);

// Health check and debug routes
app.get('/hello', (req, res) => {
  res.send('Hello, World!');
});
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

// Ignore favicon requests
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());

// API routes
app.use('/auth', authRoutes);
app.use('/teams', teamRoutes);
app.use('/tasks', taskRoutes);
app.use('/users', usersRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Test DB on startup
db.raw('SELECT 1')
  .then(() => console.log('Database connected successfully'))
  .catch((err) => console.error('Database connection error:', err));

// Export app (for Vercel or custom server)
module.exports = app;

