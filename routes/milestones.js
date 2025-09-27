const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { isAuthenticated } = require('../middleware/isAuthenticated');
const { body, validationResult } = require('express-validator');

// Middleware to check if user is a member of the milestone's team
const isTeamMember = async (req, res, next) => {
  try {
    const { team_id } = req.body;
    const { id: milestoneId } = req.params;
    let teamId = team_id;

    if (!teamId && milestoneId) {
      const milestone = await db('milestones').where({ id: milestoneId }).first();
      if (!milestone) {
        return res.status(404).json({ error: 'Milestone not found' });
      }
      teamId = milestone.team_id;
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

// Create a milestone
router.post(
  '/',
  isAuthenticated,
  [
    body('title').notEmpty().trim().withMessage('Title is required'),
    body('team_id').notEmpty().withMessage('Team ID is required'),
    body('due_date').optional().isISO8601().withMessage('Due date must be a valid date'),
    body('priority').optional().isIn(['Low', 'Medium', 'High']).withMessage('Priority must be Low, Medium, or High'),
  ],
  isTeamMember,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, team_id, due_date, priority } = req.body;

    try {
      const [milestone] = await db('milestones')
        .insert({
          title,
          description,
          team_id,
          created_by: req.user.id,
          due_date,
          priority: priority || 'Medium',
          status: 'Not Started',
          progress_percentage: 0
        })
        .returning('*');

      res.status(201).json(milestone);
    } catch (err) {
      console.error('Create milestone error:', err);
      res.status(500).json({ error: 'Failed to create milestone' });
    }
  }
);

// Get milestones for a team
router.get('/team/:teamId', isAuthenticated, async (req, res) => {
  const { teamId } = req.params;
  
  try {
    // Check if user is a member of the team
    const membership = await db('memberships')
      .where({ team_id: teamId, user_id: req.user.id })
      .first();
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    const milestones = await db('milestones')
      .where({ team_id: teamId })
      .join('users', 'milestones.created_by', 'users.id')
      .select('milestones.*', 'users.username as created_by_name')
      .orderBy('milestones.due_date', 'asc');

    // Get task counts for each milestone
    const milestonesWithTasks = await Promise.all(
      milestones.map(async (milestone) => {
        const taskCounts = await db('tasks')
          .where({ milestone_id: milestone.id })
          .select(
            db.raw('COUNT(*) as total_tasks'),
            db.raw("COUNT(CASE WHEN status = 'Done' THEN 1 END) as completed_tasks")
          )
          .first();

        const totalTasks = parseInt(taskCounts.total_tasks) || 0;
        const completedTasks = parseInt(taskCounts.completed_tasks) || 0;
        const calculatedProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Update milestone progress if it's different
        if (calculatedProgress !== milestone.progress_percentage) {
          await db('milestones')
            .where({ id: milestone.id })
            .update({ progress_percentage: calculatedProgress });
        }

        // Update status based on progress and due date
        let status = milestone.status;
        const now = new Date();
        const dueDate = milestone.due_date ? new Date(milestone.due_date) : null;

        if (calculatedProgress === 100) {
          status = 'Completed';
        } else if (dueDate && now > dueDate && calculatedProgress < 100) {
          status = 'Overdue';
        } else if (calculatedProgress > 0) {
          status = 'In Progress';
        } else {
          status = 'Not Started';
        }

        if (status !== milestone.status) {
          await db('milestones')
            .where({ id: milestone.id })
            .update({ status });
        }

        return {
          ...milestone,
          progress_percentage: calculatedProgress,
          status,
          total_tasks: totalTasks,
          completed_tasks: completedTasks
        };
      })
    );

    res.json(milestonesWithTasks);
  } catch (err) {
    console.error('Fetch milestones error:', err);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

// Get all milestones for user's teams
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const milestones = await db('milestones')
      .join('memberships', 'milestones.team_id', 'memberships.team_id')
      .join('teams', 'milestones.team_id', 'teams.id')
      .join('users', 'milestones.created_by', 'users.id')
      .where('memberships.user_id', req.user.id)
      .select(
        'milestones.*',
        'teams.name as team_name',
        'users.username as created_by_name'
      )
      .orderBy('milestones.due_date', 'asc');

    res.json(milestones);
  } catch (err) {
    console.error('Fetch all milestones error:', err);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

// Update a milestone
router.put(
  '/:id',
  isAuthenticated,
  [
    body('title').optional().notEmpty().trim().withMessage('Title cannot be empty'),
    body('due_date').optional().isISO8601().withMessage('Due date must be a valid date'),
    body('priority').optional().isIn(['Low', 'Medium', 'High']).withMessage('Priority must be Low, Medium, or High'),
    body('progress_percentage').optional().isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100'),
  ],
  isTeamMember,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { title, description, due_date, priority, progress_percentage, status } = req.body;

    try {
      const updatedRows = await db('milestones')
        .where({ id })
        .update({
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(due_date !== undefined && { due_date }),
          ...(priority && { priority }),
          ...(progress_percentage !== undefined && { progress_percentage }),
          ...(status && { status })
        });

      if (updatedRows === 0) {
        return res.status(404).json({ error: 'Milestone not found' });
      }

      const updatedMilestone = await db('milestones').where({ id }).first();
      res.json(updatedMilestone);
    } catch (err) {
      console.error('Update milestone error:', err);
      res.status(500).json({ error: 'Failed to update milestone' });
    }
  }
);

// Delete a milestone
router.delete('/:id', isAuthenticated, isTeamMember, async (req, res) => {
  const { id } = req.params;

  try {
    // Remove milestone reference from tasks
    await db('tasks').where({ milestone_id: id }).update({ milestone_id: null });

    const deletedRows = await db('milestones').where({ id }).del();
    if (deletedRows === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }
    res.json({ message: 'Milestone deleted' });
  } catch (err) {
    console.error('Delete milestone error:', err);
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
});

// Get tasks for a milestone
router.get('/:id/tasks', isAuthenticated, isTeamMember, async (req, res) => {
  try {
    const { id } = req.params;
    const tasks = await db('tasks')
      .where({ milestone_id: id })
      .join('users as assigned_to', 'tasks.assigned_to_id', 'assigned_to.id')
      .leftJoin('users as assigned_by', 'tasks.assigned_by_id', 'assigned_by.id')
      .select(
        'tasks.*',
        'assigned_to.username as assigned_to_name',
        'assigned_by.username as assigned_by_name'
      )
      .orderBy('tasks.created_at', 'desc');

    res.json(tasks);
  } catch (err) {
    console.error('Get milestone tasks error:', err);
    res.status(500).json({ error: 'Failed to get milestone tasks' });
  }
});

module.exports = router;