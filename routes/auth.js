const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const { body, validationResult } = require('express-validator');
const { db } = require('../db');

// ✅ Passport local strategy
passport.use(
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const user = await db('users').where({ email }).first();
      if (!user) return done(null, false, { message: 'Invalid email or password' });

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) return done(null, false, { message: 'Invalid email or password' });

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// ✅ Session serialization
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await db('users').where({ id }).first();
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

// ✅ Validation middleware
const validateRegister = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];
const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// ✅ POST /auth/register
router.post('/register', validateRegister, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const { username, email, password } = req.body;
  try {
    const existingUser = await db('users').where({ email }).orWhere({ username }).first();
    if (existingUser) return res.status(400).json({ error: 'Email or username already exists' });

    const password_hash = await bcrypt.hash(password, 10);
    const [user] = await db('users')
      .insert({ username, email, password_hash })
      .returning(['id', 'username', 'email']);

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: 'Session error after registration' });

      const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });
      res.status(201).json({ success: true, user, token });
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// ✅ GET /auth/register (optional - for debugging mistaken GET requests)
router.get('/register', (req, res) => {
  res.status(405).json({ error: 'Use POST to register' });
});

// ✅ POST /auth/login
router.post('/login', validateLogin, (req, res, next) => {
  passport.authenticate('local', { failureMessage: true }, (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info.message });

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: 'Login session failed' });

      const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });
      res.json({ success: true, user: { id: user.id, username: user.username, email: user.email }, token });
    });
  })(req, res, next);
});

// ✅ POST /auth/logout
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((err) => {
      if (err) return next(err);
      res.json({ success: true });
    });
  });
});

module.exports = router;

