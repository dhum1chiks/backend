// middleware/isAuthenticated.js
const jwt = require('jsonwebtoken');

function isAuthenticated(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token;

  // Safely extract token from Authorization header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace(/^Bearer\s+/, '');
  }

  if (!token) {
    console.warn(`Authentication failed: No token provided for ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Validate token payload
    if (!decoded.id || !decoded.email) {
      console.warn(`Authentication failed: Invalid token payload for ${req.method} ${req.originalUrl}`);
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
    };

    console.debug(`Authenticated user: ${req.user.id} (${req.user.email}) for ${req.method} ${req.originalUrl}`);
    next();
  } catch (error) {
    console.error(`JWT verification failed for ${req.method} ${req.originalUrl}: ${error.name} - ${error.message}`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { isAuthenticated };

