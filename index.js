const express = require('express');
const app = express();

// Basic middleware
app.use(express.json());

// CORS - allow all for testing
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Simple routes
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running!', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/test', (req, res) => {
  res.json({
    message: 'Test endpoint working',
    origin: req.get('Origin'),
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
});

app.post('/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);
  res.json({
    success: true,
    message: 'Login endpoint reached',
    data: req.body,
    timestamp: new Date().toISOString()
  });
});

// Export for Vercel
module.exports = app;

// Export for Vercel serverless functions
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} with Pusher real-time features`);
  });
}
