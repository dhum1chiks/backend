require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const Pusher = require('pusher');

// Import routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const teamRoutes = require('./routes/teams');
const userRoutes = require('./routes/users');
const milestoneRoutes = require('./routes/milestones');
const { isAuthenticated } = require('./middleware/isAuthenticated');

const app = express();

// Initialize Pusher
const pusher = new Pusher({
  appId: "2057066",
  key: "c30f759d527210673c85",
  secret: "f95d0c1d0a0e86564c7e",
  cluster: "ap1",
  useTLS: true
});

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3002',
      'https://frontend-alpha-seven-16.vercel.app',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(cookieParser());
app.use(session({ secret: process.env.SESSION_SECRET || 'your-secret-key', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// Log CORS requests for debugging
app.use((req, res, next) => {
  console.debug(`CORS request: ${req.method} ${req.originalUrl} from ${req.get('Origin')}`);
  next();
});

// Rate-limited auth routes with logging
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for ${req.method} ${req.originalUrl} from ${req.ip}`);
    res.status(429).json({ error: 'Too many requests, please try again later' });
  },
});
app.use('/auth', authRateLimiter, authRoutes);

// Mount other routes
app.use('/tasks', taskRoutes);
app.use('/teams', teamRoutes);
app.use('/users', userRoutes);
app.use('/milestones', milestoneRoutes);

// Simple test route
app.get('/hello', (req, res) => res.send('Hello from Supabase-powered backend!'));

// Example of a protected route
app.get('/protected', isAuthenticated, (req, res) => {
  res.json({ message: `Hello, user ${req.user.email}` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`Server error on ${req.method} ${req.originalUrl}:`, err);
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Pusher helper functions for real-time events
const triggerPusherEvent = (channel, event, data) => {
  try {
    pusher.trigger(channel, event, data);
    console.log(`Pusher event triggered: ${channel} -> ${event}`);
  } catch (error) {
    console.error('Pusher trigger error:', error);
  }
};

// Export pusher for use in routes
module.exports.pusher = pusher;

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with Pusher real-time features`);
});
