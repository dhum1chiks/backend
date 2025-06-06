const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const { body, validationResult } = require('express-validator');
const { db } = require('../db');

// Configure Passport Local Strategy
passport.use(
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      console.log('Attempting to authenticate:', email);
      const user = await db('users').where({ email }).first();
      console.log('User found:', user ? user.email : 'none');
      if (!user) return done(null, false, { message: 'Invalid email or password' });

      const isMatch = await bcrypt.compare(password, user.password_hash);
      console.log('Password match:', isMatch);
      if (!isMatch) return done(null, false, { message: 'Invalid email or password' });

      return done(null, user);
    } catch (err) {
      console.error('Passport strategy error:', err);
      return done(err);
    }
  })
);

// Serialize user to session
passport.serializeUser((user, done) => {
  console.log('Serializing user:', user.id);
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    console.log('Deserializing user:', id);
    const user = await db('users').where({ id }).first();
    done(null, user || false);
  } catch (err) {
    console.error('Deserialize error:', err);
    done(err);
  }
});

// Input validation middleware for registration
const validateRegister = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

// Input validation middleware for login
const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Register route
router.post('/register', validateRegister, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { username, email, password } = req.body;
  try {
    console.log('Registering user:', email);
    const existingUser = await db('users').where({ email }).orWhere({ username }).first();
    if (existingUser) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [user] = await db('users')
      .insert({ username, email, password_hash })
      .returning(['id', 'username', 'email']);

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    req.login(user, (err) => {
      if (err) {
        console.error('Login after registration error:', err);
        return res.status(500).json({ error: 'Failed to log in after registration' });
      }
      return res.status(201).json({ success: true, user, token });
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login route
router.post('/login', validateLogin, (req, res, next) => {
  console.log('Login attempt:', req.body.email);
  passport.authenticate('local', { failureMessage: true }, (err, user, info) => {
    if (err) {
      console.error('Authentication error:', err);
      return next(err);
    }
    if (!user) {
      console.log('Authentication failed:', info.message);
      return res.status(401).json({ error: info.message || 'Invalid email or password' });
    }
    req.login(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return next(err);
      }
      try {
        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
          expiresIn: '1h',
        });
        console.log('Login successful, token generated:', user.email);
        res.json({ success: true, user: { id: user.id, username: user.username, email: user.email }, token });
      } catch (err) {
        console.error('Token generation error:', err);
        res.status(500).json({ error: 'Failed to generate token' });
      }
    });
  })(req, res, next);
});

// Logout route
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return next(err);
      }
      console.log('Logout successful');
      res.json({ success: true });
    });
  });
});

module.exports = router;
