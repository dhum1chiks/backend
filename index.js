const express = require('express');
const app = express();

// Basic middleware
app.use(express.json());

// CORS - allow specific origins with credentials
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    'https://frontend-alpha-seven-16.vercel.app'
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Credentials', 'true');
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

// Mock auth for testing
app.post('/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);

  // Simple mock authentication
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required'
    });
  }

  // Mock successful login
  res.json({
    success: true,
    message: 'Login successful',
    user: {
      id: 1,
      username: 'testuser',
      email: email
    },
    token: 'mock-jwt-token-' + Date.now(),
    timestamp: new Date().toISOString()
  });
});

app.post('/auth/register', (req, res) => {
  console.log('Register attempt:', req.body);

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      error: 'Username, email, and password are required'
    });
  }

  // Mock successful registration
  res.status(201).json({
    success: true,
    message: 'Registration successful',
    user: {
      id: 1,
      username: username,
      email: email
    },
    token: 'mock-jwt-token-' + Date.now(),
    timestamp: new Date().toISOString()
  });
});

// Mock API endpoints
app.get('/teams', (req, res) => {
  res.json([
    {
      id: 1,
      name: 'Test Team',
      created_by: 1,
      created_at: new Date().toISOString()
    }
  ]);
});

app.get('/tasks/get-task', (req, res) => {
  res.json([
    {
      id: 1,
      title: 'Test Task',
      description: 'This is a test task',
      team_id: 1,
      status: 'To Do',
      created_at: new Date().toISOString()
    }
  ]);
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
