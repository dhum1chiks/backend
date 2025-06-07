const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { isAuthenticated } = require('../middleware/isAuthenticated');
const { body, validationResult } = require('express-validator');

// ✅ Create a team
router.post(
  '/',
  isAuthenticated,
  [body('name').notEmpty().trim().withMessage('Team name is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name } = req.body;
    try {
      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({ name, created_by: req.user.id })
        .select()
        .single();
      if (teamError) throw teamError;

      // Add creator as member
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

// ✅ Get all teams the user is a part of
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('teams.*')
      .in(
        'id',
        supabase
          .from('memberships')
          .select('team_id')
          .eq('user_id', req.user.id)
      );

    if (error) throw error;

    res.json(teams);
  } catch (err) {
    console.error('Fetch teams error:', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// ✅ Get team members
router.get('/:teamId/members', isAuthenticated, async (req, res) => {
  const { teamId } = req.params;
  try {
    // Check membership
    const { data: membership } = await supabase
      .from('memberships')
      .select()
      .match({ team_id: teamId, user_id: req.user.id })
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    // Fetch members
    const { data: members, error } = await supabase
      .from('memberships')
      .select('users(id, username)')
      .eq('team_id', teamId);

    if (error) throw error;

    const formatted = members.map((m) => m.users);
    res.json(formatted);
  } catch (err) {
    console.error('Fetch members error:', err);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// ✅ Add member to team
router.post(
  '/:teamId/members',
  isAuthenticated,
  [body('userId').notEmpty().withMessage('User ID is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { teamId } = req.params;
    const { userId } = req.body;

    try {
      // Validate team exists
      const { data: team } = await supabase
        .from('teams')
        .select()
        .eq('id', teamId)
        .single();

      if (!team) return res.status(404).json({ error: 'Team not found' });
      if (team.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Only team creator can add members' });
      }

      // Check user exists
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('id', userId)
        .maybeSingle();

      if (!user) return res.status(404).json({ error: 'User not found' });

      // Check membership
      const { data: membership } = await supabase
        .from('memberships')
        .select()
        .match({ team_id: teamId, user_id: userId })
        .maybeSingle();

      if (membership) {
        return res.status(400).json({ error: 'User is already a member of this team' });
      }

      // Insert membership
      const { error } = await supabase
        .from('memberships')
        .insert({ team_id: teamId, user_id: userId });

      if (error) throw error;

      res.json({ message: 'Member added' });
    } catch (err) {
      console.error('Add member error:', err);
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
);

// ✅ Delete a team
router.delete('/:teamId', isAuthenticated, async (req, res) => {
  const { teamId } = req.params;

  try {
    const { data: team } = await supabase
      .from('teams')
      .select()
      .eq('id', teamId)
      .single();

    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only team creator can delete team' });
    }

    // Delete team-related data
    await supabase.from('memberships').delete().eq('team_id', teamId);
    await supabase.from('tasks').delete().eq('team_id', teamId);
    await supabase.from('teams').delete().eq('id', teamId);

    res.json({ message: 'Team deleted' });
  } catch (err) {
    console.error('Delete team error:', err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

module.exports = router;

