require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const { isAuthenticated } = require('./middleware/isAuthenticated');

const app = express();

app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost:3001',                            // your local frontend
    'https://frontend-alpha-seven-16.vercel.app'        // your deployed frontend
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));


// Health check route
app.get('/hello', (req, res) => {
  res.send('Hello from Supabase-powered backend!');
});

// Rate limit and mount auth routes
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), authRoutes);

// Example protected route
app.get('/protected', isAuthenticated, (req, res) => {
  res.json({ message: `Hello, user ${req.user.email}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

