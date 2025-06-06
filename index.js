const result = require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const PGSession = require('connect-pg-simple')(session);
const { db } = require('./db');
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const taskRoutes = require('./routes/tasks');
const usersRouter = require('./routes/users');
const rateLimit = require('express-rate-limit');
const serverless = require('serverless-http');

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

const app = express();

app.set('trust proxy', 1); // Enable trust proxy for express-rate-limit in Vercel

app.use(express.json());

// Session configuration with PostgreSQL store
app.use(
  session({
    store: new PGSession({
      pool: require('pg').Pool,
      conString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: true,
        ca: process.env.PG_SSL_CA
      },
      tableName: 'session',
      createTableIfMissing: false // Table is created via migration
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 24 * 60 * 60 * 1000 } // 24 hours
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

// Rate limiting for auth routes to prevent abuse
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/auth', authLimiter);

// Basic health check route
app.get('/hello', (req, res) => {
  res.send('Hello, World!');
});

app.use('/auth', authRoutes);
app.use('/teams', teamRoutes);
app.use('/tasks', taskRoutes);
app.use('/users', usersRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Test database connection without exiting
db.raw('SELECT 1')
  .then(() => console.log('Database connected successfully'))
  .catch((err) => {
    console.error('Database connection error:', err);
  });

// Export for Vercel serverless
module.exports.handler = serverless(app);
