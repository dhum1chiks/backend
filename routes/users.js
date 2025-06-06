const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { isAuthenticated } = require('../middleware/isAuthenticated');

// Get all users (for adding to teams)
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const users = await db('users').select('id', 'username');
    res.json(users);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
