const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { isAuthenticated } = require('../middleware/isAuthenticated');

// ✅ Get all users (for adding to teams)
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username');

    if (error) throw error;

    res.json(users);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;

