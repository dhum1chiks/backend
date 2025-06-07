require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const { isAuthenticated } = require('./middleware/isAuthenticated');
const authRoutes = require('./routes/auth');  // You’ll adapt this
const teamRoutes = require('./routes/teams'); // Supabase versions
const taskRoutes = require('./routes/tasks');
const usersRouter = require('./routes/users');

const app = express();

// ✅ Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ✅ Middlewares
app.use(express.json());
app.use(cors({
  origin: ['https://frontend-alpha-seven-16.vercel.app'],
  credentials: true,
}));

// ✅ Health check
app.get('/hello', (req, res) => res.send('Hello from Supabase-powered backend!'));

// ✅ Routes (JWT protected via middleware)
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), authRoutes(supabase));
app.use('/teams', isAuthenticated(supabase), teamRoutes(supabase));
app.use('/tasks', isAuthenticated(supabase), taskRoutes(supabase));
app.use('/users', isAuthenticated(supabase), usersRouter(supabase));

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

