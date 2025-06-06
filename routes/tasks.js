const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { isAuthenticated } = require('../middleware/isAuthenticated');
const { body, query, validationResult } = require('express-validator');

// Middleware to check if user is a member of the task's team
const isTeamMember = async (req, res, next) => {
  try {
    const { team_id } = req.body;
    const { id: taskId } = req.params;
    let teamId = team_id;

    if (!teamId && taskId) {
      const task = await db('tasks').where({ id: taskId }).first();
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      teamId = task.team_id;
    }

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    const membership = await db('memberships')
      .where({ team_id: teamId, user_id: req.user.id })
      .first();
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }
    next();
  } catch (err) {
    console.error('Team membership check error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Create a task
router.post(
  '/create-task',
  isAuthenticated,
  [
    body('title').notEmpty().trim().withMessage('Title is required'),
    body('team_id').notEmpty().withMessage('Team ID is required'),
    body('assigned_to_id').optional().isInt().withMessage('Assigned To ID must be an integer'),
    body('due_date').optional().isISO8601().withMessage('Due date must be a valid date'),
  ],
  isTeamMember,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, team_id, assigned_to_id, due_date } = req.body;

    try {
      if (assigned_to_id) {
        const assigneeMembership = await db('memberships')
          .where({ team_id, user_id: assigned_to_id })
          .first();
        if (!assigneeMembership) {
          return res.status(400).json({ error: 'Assigned user must be a member of the team' });
        }
      }

      const [task] = await db('tasks')
        .insert({
          title,
          description,
          team_id,
          assigned_to_id,
          assigned_by_id: req.user.id, // Set the user who assigns the task
          created_by: req.user.id,
          due_date,
        })
        .returning('*');

      res.status(201).json(task);
    } catch (err) {
      console.error('Create task error:', err);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }
);

// Get all tasks for a team or assigned to a user
router.get(
  '/get-task',
  isAuthenticated,
  [
    query('team_id').optional().isInt().withMessage('Team ID must be an integer'),
    query('assigned_to_id').optional().isInt().withMessage('Assigned To ID must be an integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { team_id, assigned_to_id } = req.query;

    try {
      let query = db('tasks')
        .join('memberships', 'tasks.team_id', 'memberships.team_id')
        .where('memberships.user_id', req.user.id)
        .select('tasks.*');

      if (team_id) {
        query = query.where('tasks.team_id', team_id);
      }
      if (assigned_to_id) {
        query = query.where('tasks.assigned_to_id', assigned_to_id);
      }

      const tasks = await query;
      res.json(tasks);
    } catch (err) {
      console.error('Fetch tasks error:', err);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }
);

// Update a task
router.put(
  '/:id',
  isAuthenticated,
  [
    body('title').optional().notEmpty().trim().withMessage('Title cannot be empty'),
    body('assigned_to_id').optional().isInt().withMessage('Assigned To ID must be an integer'),
    body('due_date').optional().isISO8601().withMessage('Due date must be a valid date'),
  ],
  isTeamMember,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { title, description, assigned_to_id, due_date, status } = req.body;

    try {
      if (assigned_to_id) {
        const task = await db('tasks').where({ id }).first();
        const assigneeMembership = await db('memberships')
          .where({ team_id: task.team_id, user_id: assigned_to_id })
          .first();
        if (!assigneeMembership) {
          return res.status(400).json({ error: 'Assigned user must be a member of the team' });
        }
      }

      const updatedRows = await db('tasks')
        .where({ id })
        .update({ title, description, assigned_to_id, due_date, status });

      if (updatedRows === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const updatedTask = await db('tasks').where({ id }).first();
      res.json(updatedTask);
    } catch (err) {
      console.error('Update task error:', err);
      res.status(500).json({ error: 'Failed to update task' });
    }
  }
);

// Delete a task
router.delete('/:id', isAuthenticated, isTeamMember, async (req, res) => {
  const { id } = req.params;

  try {
    const deletedRows = await db('tasks').where({ id }).del();
    if (deletedRows === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
