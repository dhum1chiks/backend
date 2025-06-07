// index.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

// Import routes and middleware
const authRoutes = require('./routes/auth');
const { isAuthenticated } = require('./middleware/isAuthenticated');

const app = express();

// Setup Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Make Supabase available in request context (optional)
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['https://frontend-alpha-seven-16.vercel.app', 'http://localhost:3001'],
  credentials: true,
}));

// Rate limit
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), authRoutes);

// Simple test route
app.get('/hello', (req, res) => res.send('Hello from Supabase-powered backend!'));
app.get('/users', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, email, created_at, updated_at');

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    res.json({ success: true, users });
  } catch (err) {
    console.error('Unexpected error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});
// Example of a protected route
app.get('/protected', isAuthenticated, (req, res) => {
  res.json({ message: `Hello, user ${req.user.email}` });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

