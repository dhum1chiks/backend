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

// Initialize Pusher with error handling
let pusher;
try {
  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID || "2057066",
    key: process.env.PUSHER_KEY || "c30f759d527210673c85",
    secret: process.env.PUSHER_SECRET || "f95d0c1d0a0e86564c7e",
    cluster: process.env.PUSHER_CLUSTER || "ap1",
    useTLS: true
  });
} catch (error) {
  console.warn('Pusher initialization failed:', error.message);
  pusher = null;
}

// Middleware
app.use(express.json());

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3002',
      'https://frontend-alpha-seven-16.vercel.app',
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));

app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-session-secret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Log requests for debugging
app.use((req, res, next) => {
  console.debug(`Request: ${req.method} ${req.originalUrl} from ${req.get('Origin') || 'no-origin'}`);
  next();
});

// Rate limiting
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for ${req.method} ${req.originalUrl}`);
    res.status(429).json({ error: 'Too many requests, please try again later' });
  },
});
app.use('/auth', authRateLimiter);

// Mount routes
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/teams', teamRoutes);
app.use('/users', userRoutes);
app.use('/milestones', milestoneRoutes);

// Test routes
app.get('/hello', (req, res) => res.send('Hello from backend!'));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    pusher: pusher ? 'initialized' : 'failed',
    supabase: process.env.SUPABASE_URL ? 'configured' : 'missing'
  });
});

app.get('/test-cors', (req, res) => {
  res.json({
    message: 'CORS test successful',
    origin: req.get('Origin'),
    timestamp: new Date().toISOString(),
    status: 'working'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(`Error on ${req.method} ${req.originalUrl}:`, err);
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Export pusher for routes
if (pusher) {
  module.exports.pusher = pusher;
}

// Export for Vercel serverless functions
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} with Pusher real-time features`);
  });
}
