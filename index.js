require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const teamRoutes = require('./routes/teams');
const userRoutes = require('./routes/users');
const milestoneRoutes = require('./routes/milestones');
const { isAuthenticated } = require('./middleware/isAuthenticated');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3002',
      'https://frontend-alpha-seven-16.vercel.app',
    ],
    credentials: true,
  },
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

// Handle preflight OPTIONS requests
app.options('*', (req, res) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    'https://frontend-alpha-seven-16.vercel.app'
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin) || !origin) {
    res.header('Access-Control-Allow-Origin', origin || allowedOrigins[2]);
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.sendStatus(200);
});

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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join team room
  socket.on('join-team', (teamId) => {
    socket.join(`team-${teamId}`);
    console.log(`User ${socket.id} joined team-${teamId}`);
  });

  // Leave team room
  socket.on('leave-team', (teamId) => {
    socket.leave(`team-${teamId}`);
    console.log(`User ${socket.id} left team-${teamId}`);
  });

  // Handle team messages
  socket.on('send-message', async (data) => {
    try {
      const { team_id, message, user_id } = data;

      // Save message to database (simplified - would need proper implementation)
      // const { data: savedMessage } = await supabase...

      // Broadcast to team room
      io.to(`team-${team_id}`).emit('new-message', {
        team_id,
        message,
        user_id,
        created_at: new Date()
      });
    } catch (error) {
      console.error('Message send error:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Export for Vercel
module.exports = app;
