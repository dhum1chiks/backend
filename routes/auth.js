const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
<<<<<<< HEAD
const { body, validationResult } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseAnonKey ? 'Present' : 'Missing');


// Validation middleware for register
=======
const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const { body, validationResult } = require('express-validator');
const supabase = require('../supabaseClient');
const rateLimit = require('express-rate-limit');

// Configure Passport Local Strategy
passport.use(
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      console.log('Attempting to authenticate:', email);
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        console.log('User not found:', error?.message);
        return done(null, false, { message: 'Invalid email or password' });
      }

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
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Deserialize error:', error);
      return done(error);
    }

    done(null, user || false);
  } catch (err) {
    console.error('Deserialize error:', err);
    done(err);
  }
});

// Input validation middleware for registration
>>>>>>> 6b1fede (lot of functionalities)
const validateRegister = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

<<<<<<< HEAD
// Validation middleware for login
=======
// Input validation middleware for login
>>>>>>> 6b1fede (lot of functionalities)
const validateLogin = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

<<<<<<< HEAD
// POST /auth/register
router.post('/register', validateRegister, async (req, res) => {
	console.log("register")
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.warn('Validation failed:', errors.array());
=======
// Apply rate limiting to all requests
router.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
}));

// Register route
router.post('/register', validateRegister, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
>>>>>>> 6b1fede (lot of functionalities)
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { username, email, password } = req.body;
<<<<<<< HEAD

  try {
    // ✅ Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${email},username.eq.${username}`)
      .maybeSingle(); // avoids crashing if no record found

    if (fetchError) {
      console.error("Supabase fetch error:", fetchError);
      return res.status(500).json({ error: 'Error checking for existing user' });
    }
=======
  try {
    console.log('Registering user:', email);

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${email},username.eq.${username}`)
      .single();
>>>>>>> 6b1fede (lot of functionalities)

    if (existingUser) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

<<<<<<< HEAD
    // ✅ Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // ✅ Insert user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ username, email, password_hash }])
      .select('id, username, email')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({ error: 'Error creating user' });
    }

    // ✅ Sign JWT
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(201).json({ success: true, user: newUser, token });
  } catch (err) {
    console.error('Unexpected error during registration:', err);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});
// POST /auth/login
router.post('/login', validateLogin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ error: errors.array()[0].msg });

  const { email, password } = req.body;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user)
      return res.status(401).json({ error: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch)
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      success: true,
      user: { id: user.id, username: user.username, email: user.email },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

router.get('/users', async (req, res) => {
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

module.exports = router;

=======
    const password_hash = await bcrypt.hash(password, 10);

    const { data: user, error } = await supabase
      .from('users')
      .insert({ username, email, password_hash })
      .select('id, username, email')
      .single();

    if (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ error: 'Failed to register user' });
    }

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
>>>>>>> 6b1fede (lot of functionalities)
