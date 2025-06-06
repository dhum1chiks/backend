const result = require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db } = require('./db');
const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const taskRoutes = require('./routes/tasks');
const usersRouter = require('./routes/users');
const rateLimit = require('express-rate-limit');

if (result.error) {
  console.error('Error loading .env file:', result.error.message);
}

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set');
}
if (!process.env.JWT_SECRET) {
  console.error('Error: JWT_SECRET is not set');
}

const app = express();

app.use(express.json());

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

// Export the app for Vercel serverless
module.exports = app;
