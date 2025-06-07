const express = require('express');
const router = express.Router();
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
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
