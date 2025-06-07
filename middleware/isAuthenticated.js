const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Initialize Supabase client (only if needed, you may already have this in your project)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function isAuthenticated(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.warn('Authentication failed: No token provided');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify JWT token with your Supabase JWT secret
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);

    // Attach user info from the decoded token to req.user
    req.user = {
      id: decoded.sub,  // Supabase uses "sub" claim as user ID
      email: decoded.email,
      role: decoded.role, // Optional, Supabase token may contain user role
    };

    console.log('Supabase JWT authenticated user:', req.user);
    return next();
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { isAuthenticated };

