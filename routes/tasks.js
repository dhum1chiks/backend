const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { isAuthenticated } = require('../middleware/isAuthenticated');
const { body, query, validationResult } = require('express-validator');

// ✅ Helper: Check if user is a member of the team
const isTeamMember = async (req, res, next) => {
  try {
    const { team_id } = req.body;
    const { id: taskId } = req.params;
    let teamId = team_id;

    if (!teamId && taskId) {
      const { data: task, error } = await supabase
        .from('tasks')
        .select('team_id')
        .eq('id', taskId)
        .single();

      if (!task || error) return res.status(404).json({ error: 'Task not found' });
      teamId = task.team_id;
    }

    if (!teamId) return res.status(400).json({ error: 'Team ID is required' });

    const { data: membership } = await supabase
      .from('memberships')
      .select()
      .match({ team_id: teamId, user_id: req.user.id })
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    next();
  } catch (err) {
    console.error('Membership check error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ POST /tasks/create-task
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
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, description, team_id, assigned_to_id, due_date } = req.body;

    try {
      if (assigned_to_id) {
        const { data: assigneeMembership } = await supabase
          .from('memberships')
          .select()
          .match({ team_id, user_id: assigned_to_id })
          .maybeSingle();

        if (!assigneeMembership) {
          return res.status(400).json({ error: 'Assigned user must be a team member' });
        }
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .insert([
          {
            title,
            description,
            team_id,
            assigned_to_id,
            assigned_by_id: req.user.id,
            created_by: req.user.id,
            due_date,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(task);
    } catch (err) {
      console.error('Create task error:', err);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }
);

// ✅ GET /tasks/get-task
router.get(
  '/get-task',
  isAuthenticated,
  [
    query('team_id').optional().isInt().withMessage('Team ID must be an integer'),
    query('assigned_to_id').optional().isInt().withMessage('Assigned To ID must be an integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { team_id, assigned_to_id } = req.query;

    try {
      // First, get all team_ids this user belongs to
      const { data: memberships } = await supabase
        .from('memberships')
        .select('team_id')
        .eq('user_id', req.user.id);

      const teamIds = memberships.map((m) => m.team_id);

      let query = supabase
        .from('tasks')
        .select('*')
        .in('team_id', teamIds);

      if (team_id) {
        query = query.eq('team_id', team_id);
      }
      if (assigned_to_id) {
        query = query.eq('assigned_to_id', assigned_to_id);
      }

      const { data: tasks, error } = await query;

      if (error) throw error;

      res.json(tasks);
    } catch (err) {
      console.error('Fetch tasks error:', err);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }
);

// ✅ PUT /tasks/:id
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
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const { title, description, assigned_to_id, due_date, status } = req.body;

    try {
      if (assigned_to_id) {
        const { data: task } = await supabase
          .from('tasks')
          .select('team_id')
          .eq('id', id)
          .single();

        const { data: assigneeMembership } = await supabase
          .from('memberships')
          .select()
          .match({ team_id: task.team_id, user_id: assigned_to_id })
          .maybeSingle();

        if (!assigneeMembership) {
          return res.status(400).json({ error: 'Assigned user must be a member of the team' });
        }
      }

      const { error: updateError } = await supabase
        .from('tasks')
        .update({ title, description, assigned_to_id, due_date, status })
        .eq('id', id);

      if (updateError) throw updateError;

      const { data: updatedTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();

      res.json(updatedTask);
    } catch (err) {
      console.error('Update task error:', err);
      res.status(500).json({ error: 'Failed to update task' });
    }
  }
);

// ✅ DELETE /tasks/:id
router.delete('/:id', isAuthenticated, isTeamMember, async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;

    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;

