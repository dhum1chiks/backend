const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { isAuthenticated } = require('../middleware/isAuthenticated');
const { body, validationResult } = require('express-validator');

// Create a new team
router.post(
  '/',
  isAuthenticated,
  [body('name').notEmpty().trim().withMessage('Team name is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.body;
    try {
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({ name, created_by: req.user.id })
        .select('id, name, created_by, created_at, updated_at')
        .single();
      if (teamError) throw teamError;

      const { error: memberError } = await supabase
        .from('memberships')
        .insert({ team_id: team.id, user_id: req.user.id });
      if (memberError) throw memberError;

      res.status(201).json(team);
    } catch (err) {
      console.error('Create team error:', err);
      res.status(500).json({ error: 'Failed to create team' });
    }
  }
);

// Fetch all teams for the authenticated user
router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Fetch team_ids from memberships for the authenticated user
    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('team_id')
      .eq('user_id', req.user.id);

    if (membershipError) throw membershipError;

    // Extract team_ids
    const teamIds = memberships.map((m) => m.team_id);

    // Fetch teams with matching team_ids
    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select('id, name, created_by, created_at, updated_at')
      .in('id', teamIds.length ? teamIds : [0]); // Handle empty teamIds case

    if (teamError) throw teamError;

    console.log('Fetched teams:', teams);
    res.json(teams || []);
  } catch (err) {
    console.error('Fetch teams error:', {
      message: err.message,
      code: err.code,
      details: err.details
    });
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Fetch members of a specific team
router.get('/:teamId/members', isAuthenticated, async (req, res) => {
  const { teamId } = req.params;
  try {
    // Verify user is a member of the team
    const { data: membership } = await supabase
      .from('memberships')
      .select()
      .match({ team_id: parseInt(teamId), user_id: req.user.id })
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    // Fetch members with user details
    const { data: members, error } = await supabase
      .from('memberships')
      .select('user_id, users(id, username, email)')
      .eq('team_id', parseInt(teamId));

    if (error) throw error;

    const formatted = members.map((m) => ({
      id: m.users.id,
      username: m.users.username,
      email: m.users.email
    }));
    console.log('Fetched members for team', teamId, ':', formatted);
    res.json(formatted);
  } catch (err) {
    console.error('Fetch members error:', {
      message: err.message,
      code: err.code,
      details: err.details
    });
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Add a member to a team
router.post(
  '/:teamId/members',
  isAuthenticated,
  [body('userId').isInt().withMessage('User ID must be an integer')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { teamId } = req.params;
    const { userId } = req.body;

    try {
      // Verify team exists and user is the creator
      const { data: team } = await supabase
        .from('teams')
        .select('id, created_by')
        .eq('id', parseInt(teamId))
        .single();

      if (!team) return res.status(404).json({ error: 'Team not found' });
      if (team.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Only team creator can add members' });
      }

      // Verify user exists
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', parseInt(userId))
        .maybeSingle();

      if (!user) return res.status(404).json({ error: 'User not found' });

      // Check if user is already a member
      const { data: membership } = await supabase
        .from('memberships')
        .select()
        .match({ team_id: parseInt(teamId), user_id: parseInt(userId) })
        .maybeSingle();

      if (membership) {
        return res.status(400).json({ error: 'User is already a member of this team' });
      }

      // Add member
      const { error } = await supabase
        .from('memberships')
        .insert({ team_id: parseInt(teamId), user_id: parseInt(userId) });

      if (error) throw error;

      res.json({ message: 'Member added successfully' });
    } catch (err) {
      console.error('Add member error:', {
        message: err.message,
        code: err.code,
        details: err.details
      });
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
);

// Delete a team
router.delete('/:teamId', isAuthenticated, async (req, res) => {
  const { teamId } = req.params;

  try {
    // Verify team exists and user is the creator
    const { data: team } = await supabase
      .from('teams')
      .select('id, created_by')
      .eq('id', parseInt(teamId))
      .single();

    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only team creator can delete team' });
    }

    // Delete related memberships and tasks (handled by ON DELETE CASCADE)
    await supabase.from('teams').delete().eq('id', parseInt(teamId));

    res.json({ message: 'Team deleted successfully' });
  } catch (err) {
    console.error('Delete team error:', {
      message: err.message,
      code: err.code,
      details: err.details
    });
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

module.exports = router;
