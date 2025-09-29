const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { isAuthenticated } = require('../middleware/isAuthenticated');
const { body, validationResult } = require('express-validator');
const { pusher } = require('../index');

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

      if (teamError) {
        console.error('Create team error:', teamError);
        return res.status(500).json({ error: 'Failed to create team' });
      }

      const { error: memberError } = await supabase
        .from('memberships')
        .insert({ team_id: team.id, user_id: req.user.id });

      if (memberError) {
        console.error('Add member error:', memberError);
        return res.status(500).json({ error: 'Failed to add creator as member' });
      }

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

    if (membershipError) {
      console.error('Membership fetch error:', membershipError);
      return res.status(500).json({ error: 'Failed to fetch teams' });
    }

    // Extract team_ids
    const teamIds = memberships.map((m) => m.team_id);

    // Fetch teams with matching team_ids
    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select('id, name, created_by, created_at, updated_at')
      .in('id', teamIds.length ? teamIds : [0]); // Handle empty teamIds case

    if (teamError) {
      console.error('Team fetch error:', teamError);
      return res.status(500).json({ error: 'Failed to fetch teams' });
    }

    console.log('Fetched teams:', teams);
    res.json(teams || []);
  } catch (err) {
    console.error('Fetch teams error:', err);
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

    if (error) {
      console.error('Members fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch team members' });
    }

    const formatted = members.map((m) => ({
      id: m.users.id,
      username: m.users.username,
      email: m.users.email
    }));

    console.log('Fetched members for team', teamId, ':', formatted);
    res.json(formatted);
  } catch (err) {
    console.error('Fetch members error:', err);
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

      if (error) {
        console.error('Add member error:', error);
        return res.status(500).json({ error: 'Failed to add member' });
      }

      res.json({ message: 'Member added successfully' });
    } catch (err) {
      console.error('Add member error:', err);
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
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', parseInt(teamId));

    if (error) {
      console.error('Delete team error:', error);
      return res.status(500).json({ error: 'Failed to delete team' });
    }

    res.json({ message: 'Team deleted successfully' });
  } catch (err) {
    console.error('Delete team error:', err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Get messages for a team
router.get('/:teamId/messages', isAuthenticated, async (req, res) => {
  const { teamId } = req.params;
  try {
    // Verify user is a member of the team
    const { data: membership } = await supabase
      .from('memberships')
      .select()
      .match({ team_id: parseInt(teamId), user_id: req.user.id })
      .maybeSingle();

    if (!membership) {
      // Check if user is team creator
      const { data: team } = await supabase
        .from('teams')
        .select('created_by')
        .eq('id', parseInt(teamId))
        .single();

      if (!team || team.created_by !== req.user.id) {
        return res.status(403).json({ error: 'You are not a member of this team' });
      }
    }

    // Fetch messages with user details
    const { data: messages, error } = await supabase
      .from('team_messages')
      .select(`
        id,
        message,
        user_id,
        created_at,
        users!team_messages_user_id_fkey (
          username
        )
      `)
      .eq('team_id', parseInt(teamId))
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Messages fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    const formatted = messages.map((msg) => ({
      id: msg.id,
      message: msg.message,
      user_id: msg.user_id,
      username: msg.users?.username || 'Unknown',
      created_at: msg.created_at
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message to a team
router.post(
  '/:teamId/messages',
  isAuthenticated,
  [body('message').notEmpty().trim().withMessage('Message is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { teamId } = req.params;
    const { message } = req.body;

    try {
      // Verify user is a member of the team
      const { data: membership } = await supabase
        .from('memberships')
        .select()
        .match({ team_id: parseInt(teamId), user_id: req.user.id })
        .maybeSingle();

      if (!membership) {
        // Check if user is team creator
        const { data: team } = await supabase
          .from('teams')
          .select('created_by')
          .eq('id', parseInt(teamId))
          .single();

        if (!team || team.created_by !== req.user.id) {
          return res.status(403).json({ error: 'You are not a member of this team' });
        }
      }

      // Save message to database
      const { data: savedMessage, error: insertError } = await supabase
        .from('team_messages')
        .insert({
          team_id: parseInt(teamId),
          user_id: req.user.id,
          message: message.trim()
        })
        .select(`
          id,
          message,
          user_id,
          created_at,
          users!team_messages_user_id_fkey (
            username
          )
        `)
        .single();

      if (insertError) {
        console.error('Save message error:', insertError);
        return res.status(500).json({ error: 'Failed to save message' });
      }

      const formattedMessage = {
        id: savedMessage.id,
        message: savedMessage.message,
        user_id: savedMessage.user_id,
        username: savedMessage.users?.username || 'Unknown',
        created_at: savedMessage.created_at
      };

      // Trigger Pusher event for real-time updates
      pusher.trigger(`team-${teamId}`, 'new-message', formattedMessage);

      res.status(201).json(formattedMessage);
    } catch (err) {
      console.error('Send message error:', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }
);

// Delete a message
router.delete('/messages/:messageId', isAuthenticated, async (req, res) => {
  const { messageId } = req.params;

  try {
    // Get message to verify ownership and get team_id
    const { data: message, error: fetchError } = await supabase
      .from('team_messages')
      .select('user_id, team_id')
      .eq('id', parseInt(messageId))
      .single();

    if (fetchError || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    // Delete message
    const { error: deleteError } = await supabase
      .from('team_messages')
      .delete()
      .eq('id', parseInt(messageId));

    if (deleteError) {
      console.error('Delete message error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete message' });
    }

    // Trigger Pusher event for real-time updates
    pusher.trigger(`team-${message.team_id}`, 'message-deleted', {
      messageId: parseInt(messageId)
    });

    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Get invitations for current user
router.get('/invitations', isAuthenticated, async (req, res) => {
  try {
    const { data: invitations, error } = await supabase
      .from('invitations')
      .select(`
        *,
        teams!invitations_team_id_fkey (
          name
        ),
        users!invitations_inviter_id_fkey (
          username
        )
      `)
      .eq('invitee_id', req.user.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Fetch invitations error:', error);
      return res.status(500).json({ error: 'Failed to fetch invitations' });
    }

    const formatted = invitations.map(inv => ({
      id: inv.id,
      team_id: inv.team_id,
      team_name: inv.teams?.name || 'Unknown Team',
      inviter_name: inv.users?.username || 'Unknown User',
      status: inv.status,
      created_at: inv.created_at
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Fetch invitations error:', err);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Remove member from team
router.delete('/:teamId/members/:userId', isAuthenticated, async (req, res) => {
  const { teamId, userId } = req.params;

  try {
    // Check if user is team creator or the member themselves
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('created_by')
      .eq('id', parseInt(teamId))
      .single();

    if (teamError || !team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const canRemove = team.created_by === req.user.id || parseInt(userId) === req.user.id;

    if (!canRemove) {
      return res.status(403).json({ error: 'You can only remove yourself or be the team creator' });
    }

    // Remove membership
    const { error: deleteError } = await supabase
      .from('memberships')
      .delete()
      .eq('team_id', parseInt(teamId))
      .eq('user_id', parseInt(userId));

    if (deleteError) {
      console.error('Remove member error:', deleteError);
      return res.status(500).json({ error: 'Failed to remove member' });
    }

    res.json({ message: 'Member removed successfully' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;
