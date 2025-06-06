const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { isAuthenticated } = require('../middleware/isAuthenticated');
const { body, validationResult } = require('express-validator');

// Create a team
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
      const [team] = await db('teams')
        .insert({ name, created_by: req.user.id })
        .returning('*');

      await db('memberships').insert({ team_id: team.id, user_id: req.user.id });
      res.status(201).json(team);
    } catch (err) {
      console.error('Create team error:', err);
      res.status(500).json({ error: 'Failed to create team' });
    }
  }
);

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
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get team members
router.get('/:teamId/members', isAuthenticated, async (req, res) => {
  const { teamId } = req.params;
  try {
    // Check if user is a member of the team
    const membership = await db('memberships')
      .where({ team_id: teamId, user_id: req.user.id })
      .first();
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    const members = await db('memberships')
      .join('users', 'memberships.user_id', 'users.id')
      .where('memberships.team_id', teamId)
      .select('users.id', 'users.username');
    res.json(members);
  } catch (err) {
    console.error('Fetch members error:', err);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Add a member to a team
router.post(
  '/:teamId/members',
  isAuthenticated,
  [body('userId').notEmpty().withMessage('User ID is required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.body;
    const { teamId } = req.params;
    try {
      const team = await db('teams').where({ id: teamId }).first();
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
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
);

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
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

module.exports = router;
