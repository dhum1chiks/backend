require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Create minimal app for testing
const app = express();

// Middleware
app.use(express.json());

// CORS configuration - allow all for testing
app.use(cors({
  origin: true, // Allow all origins for testing
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));

// Simple test routes
app.get('/hello', (req, res) => {
  res.send('Hello from backend!');
});

app.get('/test-cors', (req, res) => {
  res.json({
    message: 'CORS test successful',
    origin: req.get('Origin'),
    timestamp: new Date().toISOString(),
    status: 'working'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    message: 'Backend is running successfully'
  });
});

// Test auth endpoint
app.post('/auth/login', (req, res) => {
  res.json({
    success: true,
    message: 'Login endpoint is working',
    data: req.body
  });
});

// Export for Vercel serverless functions
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} with Pusher real-time features`);
  });
}
