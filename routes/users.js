const express = require('express');
const router = express.Router();
<<<<<<< HEAD
const supabase = require('../supabaseClient');
const { isAuthenticated } = require('../middleware/isAuthenticated');

// GET /users - Fetch all users for team member selection
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, email')
      .order('username', { ascending: true });

    if (error) throw error;

    // Wrap users in an object to match Dashboard.jsx expectations
    res.json({ users: users || [] });
  } catch (err) {
    console.error('Fetch users error:', {
      message: err.message,
      code: err.code,
      details: err.details,
    });
=======
const { db } = require('../db');
const { isAuthenticated } = require('../middleware/isAuthenticated');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create avatars directory if it doesn't exist
const avatarsDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

// Multer configuration for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for avatars
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars'));
    }
  }
});

// Get all users (for adding to teams)
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const users = await db('users').select('id', 'username', 'avatar_url');
    res.json(users);
  } catch (err) {
    console.error('Fetch users error:', err);
>>>>>>> 6b1fede (lot of functionalities)
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

<<<<<<< HEAD
=======
// Get current user profile
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const user = await db('users')
      .where({ id: req.user.id })
      .select('id', 'username', 'email', 'avatar_url', 'bio', 'phone', 'timezone', 'notification_settings', 'theme_settings')
      .first();
    res.json(user);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', isAuthenticated, [
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
  body('phone').optional({ nullable: true, checkFalsy: true }).isLength({ min: 10, max: 15 }).matches(/^[\+]?[0-9\-\(\)\s]+$/).withMessage('Valid phone number is required'),
  body('timezone').optional().isString().withMessage('Timezone must be a string'),
  body('notification_settings').optional().isObject().withMessage('Notification settings must be an object'),
  body('theme_settings').optional().isObject().withMessage('Theme settings must be an object')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { bio, phone, timezone, notification_settings, theme_settings } = req.body;

    const updateData = {};
    if (bio !== undefined) updateData.bio = bio;
    if (phone !== undefined) updateData.phone = phone;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (notification_settings !== undefined) updateData.notification_settings = JSON.stringify(notification_settings);
    if (theme_settings !== undefined) updateData.theme_settings = JSON.stringify(theme_settings);

    await db('users').where({ id: req.user.id }).update(updateData);
    
    const updatedUser = await db('users')
      .where({ id: req.user.id })
      .select('id', 'username', 'email', 'avatar_url', 'bio', 'phone', 'timezone', 'notification_settings', 'theme_settings')
      .first();
    
    res.json(updatedUser);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload avatar
router.post('/avatar', isAuthenticated, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No avatar file uploaded' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    // Delete old avatar if exists
    const user = await db('users').where({ id: req.user.id }).first();
    if (user.avatar_url) {
      const oldAvatarPath = path.join(__dirname, '..', user.avatar_url);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    await db('users').where({ id: req.user.id }).update({ avatar_url: avatarUrl });
    
    res.json({ avatar_url: avatarUrl });
  } catch (err) {
    console.error('Upload avatar error:', err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Delete avatar
router.delete('/avatar', isAuthenticated, async (req, res) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    
    if (user.avatar_url) {
      const avatarPath = path.join(__dirname, '..', user.avatar_url);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }

    await db('users').where({ id: req.user.id }).update({ avatar_url: null });
    
    res.json({ message: 'Avatar deleted' });
  } catch (err) {
    console.error('Delete avatar error:', err);
    res.status(500).json({ error: 'Failed to delete avatar' });
  }
});

>>>>>>> 6b1fede (lot of functionalities)
module.exports = router;
