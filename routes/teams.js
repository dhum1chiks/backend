const express = require('express');
const router = express.Router();
<<<<<<< HEAD
const supabase = require('../supabaseClient');
const { isAuthenticated } = require('../middleware/isAuthenticated');
const { body, validationResult } = require('express-validator');

// Create a new team
=======
const { db } = require('../db');
const { isAuthenticated } = require('../middleware/isAuthenticated');
const { body, validationResult } = require('express-validator');

// Create a team
>>>>>>> 6b1fede (lot of functionalities)
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
<<<<<<< HEAD
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

=======
      const [team] = await db('teams')
        .insert({ name, created_by: req.user.id })
        .returning('*');

      await db('memberships').insert({ team_id: team.id, user_id: req.user.id });
>>>>>>> 6b1fede (lot of functionalities)
      res.status(201).json(team);
    } catch (err) {
      console.error('Create team error:', err);
      res.status(500).json({ error: 'Failed to create team' });
    }
  }
);

<<<<<<< HEAD
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
=======
// Get all teams user is part of
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const teams = await db('teams')
      .join('memberships', 'teams.id', 'memberships.team_id')
      .where('memberships.user_id', req.user.id)
      .select('teams.*');
    res.json(teams);
  } catch (err) {
    console.error('Fetch teams error:', err);
>>>>>>> 6b1fede (lot of functionalities)
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

<<<<<<< HEAD
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

=======
// Get team members
router.get('/:teamId/members', isAuthenticated, async (req, res) => {
  const { teamId } = req.params;
  try {
    // Check if user is a member of the team
    const membership = await db('memberships')
      .where({ team_id: teamId, user_id: req.user.id })
      .first();
>>>>>>> 6b1fede (lot of functionalities)
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

<<<<<<< HEAD
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
=======
    const members = await db('memberships')
      .join('users', 'memberships.user_id', 'users.id')
      .where('memberships.team_id', teamId)
      .select('users.id', 'users.username');
    res.json(members);
  } catch (err) {
    console.error('Fetch members error:', err);
>>>>>>> 6b1fede (lot of functionalities)
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Add a member to a team
router.post(
  '/:teamId/members',
  isAuthenticated,
<<<<<<< HEAD
  [body('userId').isInt().withMessage('User ID must be an integer')],
=======
  [body('userId').notEmpty().withMessage('User ID is required')],
>>>>>>> 6b1fede (lot of functionalities)
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

<<<<<<< HEAD
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
=======
    const { userId } = req.body;
    const { teamId } = req.params;
    try {
      const team = await db('teams').where({ id: teamId }).first();
      console.log('Add member debug:', { teamId, creator: team.created_by, user: req.user.id }); // Debug log
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }
      if (team.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Only team creator can add members' });
      }
      const userExists = await db('users').where({ id: userId }).first();
      if (!userExists) {
        return res.status(404).json({ error: 'User not found' });
      }
      const existingMembership = await db('memberships')
        .where({ team_id: teamId, user_id: userId })
        .first();
      if (existingMembership) {
        return res.status(400).json({ error: 'User is already a member of this team' });
      }
      await db('memberships').insert({ team_id: teamId, user_id: userId });
      res.json({ message: 'Member added' });
    } catch (err) {
      console.error('Add member error:', err);
>>>>>>> 6b1fede (lot of functionalities)
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
);

<<<<<<< HEAD
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
=======
// Invite member by email
router.post('/:teamId/invite', isAuthenticated, async (req, res) => {
  const { email } = req.body;
  try {
    const team = await db('teams').where({ id: req.params.teamId }).first();
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.created_by !== req.user.id) return res.status(403).json({ error: 'Only team creator can invite members' });
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    const existingMembership = await db('memberships').where({ team_id: team.id, user_id: user.id }).first();
    if (existingMembership) return res.status(400).json({ error: 'User is already a member' });
    const existingInvitation = await db('invitations').where({ team_id: team.id, invitee_id: user.id }).first();
    if (existingInvitation) return res.status(400).json({ error: 'Invitation already sent' });
    await db('invitations').insert({ team_id: team.id, inviter_id: req.user.id, invitee_id: user.id });

    // Send email notification
    const { sendInvitationEmail } = require('../utils/email');
    const inviter = await db('users').where({ id: req.user.id }).first();
    try {
      await sendInvitationEmail(user.email, team.name, inviter.username);
    } catch (emailErr) {
      console.error('Failed to send invitation email:', emailErr);
      // Don't fail the request if email fails
    }

    // Emit real-time notification
    const io = req.app.get('io');
    io.to(`user-${user.id}`).emit('invitation-received', {
      id: user.id,
      team_name: team.name,
      inviter_name: req.user.username,
      message: `You have been invited to join team "${team.name}" by ${req.user.username}`
    });

    res.json({ success: true, message: 'Invitation sent successfully' });
  } catch (err) {
    console.error('Invite member error:', err);
    res.status(500).json({ error: 'Failed to invite member' });
  }
});

// Delete a team
router.delete('/:teamId', isAuthenticated, async (req, res) => {
  const { teamId } = req.params;
  try {
    const team = await db('teams').where({ id: teamId }).first();
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    if (team.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only team creator can delete team' });
    }
    await db('memberships').where({ team_id: teamId }).del();
    await db('tasks').where({ team_id: teamId }).del();
    await db('teams').where({ id: teamId }).del();
    res.json({ message: 'Team deleted' });
  } catch (err) {
    console.error('Delete team error:', err);
>>>>>>> 6b1fede (lot of functionalities)
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

<<<<<<< HEAD
=======
// Remove a member from a team OR allow a member to leave the team
router.delete('/:teamId/members/:userId', isAuthenticated, async (req, res) => {
  const { teamId, userId } = req.params;
  try {
    const team = await db('teams').where({ id: teamId }).first();
    if (!team) return res.status(404).json({ error: 'Team not found' });
    // Team creator can remove any member except themselves
    // Any member can remove themselves (leave team)
    if (parseInt(userId) !== req.user.id && team.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only team creator can remove other members, or you can leave the team yourself.' });
    }
    if (team.created_by === parseInt(userId) && team.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Creator cannot be removed by others.' });
    }
    const membership = await db('memberships').where({ team_id: teamId, user_id: userId }).first();
    if (!membership) return res.status(404).json({ error: 'Membership not found' });
    await db('memberships').where({ team_id: teamId, user_id: userId }).del();
    res.json({ message: parseInt(userId) === req.user.id ? 'You have left the team.' : 'Member removed' });
  } catch (err) {
    console.error('Remove/leave member error:', err);
    res.status(500).json({ error: 'Failed to remove/leave member' });
  }
});

// Get pending invitations for the current user
router.get('/invitations', isAuthenticated, async (req, res) => {
  try {
    const invitations = await db('invitations')
      .where({ invitee_id: req.user.id, status: 'pending' })
      .join('teams', 'invitations.team_id', 'teams.id')
      .join('users', 'invitations.inviter_id', 'users.id')
      .select('invitations.id', 'teams.name as team_name', 'users.username as inviter_name', 'invitations.created_at');
    res.json(invitations);
  } catch (err) {
    console.error('Fetch invitations error:', err);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Accept invitation
router.post('/invitations/:id/accept', isAuthenticated, async (req, res) => {
  try {
    const invitation = await db('invitations').where({ id: req.params.id, invitee_id: req.user.id }).first();
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.status !== 'pending') return res.status(400).json({ error: 'Invitation already processed' });

    await db('memberships').insert({ team_id: invitation.team_id, user_id: req.user.id });
    await db('invitations').where({ id: req.params.id }).update({ status: 'accepted' });
    res.json({ success: true, message: 'Invitation accepted' });
  } catch (err) {
    console.error('Accept invitation error:', err);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Decline invitation
router.post('/invitations/:id/decline', isAuthenticated, async (req, res) => {
  try {
    const invitation = await db('invitations').where({ id: req.params.id, invitee_id: req.user.id }).first();
    if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
    if (invitation.status !== 'pending') return res.status(400).json({ error: 'Invitation already processed' });

    await db('invitations').where({ id: req.params.id }).update({ status: 'declined' });
    res.json({ success: true, message: 'Invitation declined' });
  } catch (err) {
    console.error('Decline invitation error:', err);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

// Get team chat messages
router.get('/:teamId/messages', isAuthenticated, async (req, res) => {
  const { teamId } = req.params;
  try {
    // Check if user is a member of the team
    const membership = await db('memberships')
      .where({ team_id: teamId, user_id: req.user.id })
      .first();
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    const messages = await db('team_messages')
      .where({ team_id: teamId })
      .join('users', 'team_messages.user_id', 'users.id')
      .select('team_messages.*', 'users.username', 'users.avatar_url')
      .orderBy('team_messages.created_at', 'asc')
      .limit(100); // Limit to last 100 messages

    res.json(messages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Send team chat message
router.post('/:teamId/messages', isAuthenticated, async (req, res) => {
  const { teamId } = req.params;
  const { message, message_type = 'text', metadata = null } = req.body;
  
  try {
    // Check if user is a member of the team
    const membership = await db('memberships')
      .where({ team_id: teamId, user_id: req.user.id })
      .first();
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    const [newMessage] = await db('team_messages')
      .insert({
        team_id: teamId,
        user_id: req.user.id,
        message,
        message_type,
        metadata: metadata ? JSON.stringify(metadata) : null
      })
      .returning('*');

    // Get message with user info
    const messageWithUser = await db('team_messages')
      .where({ 'team_messages.id': newMessage.id })
      .join('users', 'team_messages.user_id', 'users.id')
      .select('team_messages.*', 'users.username', 'users.avatar_url')
      .first();

    // Emit to all team members via WebSocket
    const io = req.app.get('io');
    const teamMembers = await db('memberships')
      .where({ team_id: teamId })
      .select('user_id');
    
    teamMembers.forEach(member => {
      io.to(`user-${member.user_id}`).emit('team-message', {
        teamId: parseInt(teamId),
        message: messageWithUser
      });
    });

    res.status(201).json(messageWithUser);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Delete team chat message
router.delete('/messages/:messageId', isAuthenticated, async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await db('team_messages').where({ id: messageId }).first();

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    await db('team_messages').where({ id: messageId }).del();
    
    // Emit deletion to team members
    const io = req.app.get('io');
    const teamMembers = await db('memberships')
      .where({ team_id: message.team_id })
      .select('user_id');
    
    teamMembers.forEach(member => {
      io.to(`user-${member.user_id}`).emit('message-deleted', {
        teamId: message.team_id,
        messageId: parseInt(messageId)
      });
    });

    res.json({ message: 'Message deleted' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

>>>>>>> 6b1fede (lot of functionalities)
module.exports = router;
