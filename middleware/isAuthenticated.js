const jwt = require('jsonwebtoken');

function isAuthenticated(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.id, email: decoded.email };
      console.log('JWT authenticated user:', req.user);
      return next();
    } catch (err) {
      console.error('JWT verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  }

  if (req.session.passport && req.session.passport.user) {
    req.user = { id: req.session.passport.user };
    console.log('Session authenticated user ID:', req.user.id);
    return next();
  }

  console.warn('Authentication failed: No valid JWT or session found');
  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { isAuthenticated };