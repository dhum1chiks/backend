const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { isAuthenticated } = require('../middleware/isAuthenticated');
const { body, query, validationResult } = require('express-validator');

// Helper: Check if user is a member of the team
const isTeamMember = async (req, res, next) => {
  try {
    const { team_id } = req.body;
    const { id: taskId } = req.params;
    let teamId = team_id;

    // Validate team_id if provided in body
    if (team_id && isNaN(parseInt(team_id))) {
      return res.status(400).json({ error: 'Team ID must be an integer' });
    }

    // If team_id is not in body, get it from task
    if (!teamId && taskId) {
      if (isNaN(parseInt(taskId))) {
        return res.status(400).json({ error: 'Task ID must be an integer' });
      }
      const { data: task, error } = await supabase
        .from('tasks')
        .select('team_id')
        .eq('id', parseInt(taskId))
        .single();

      if (error || !task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      teamId = task.team_id;
    }

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Check if user is a member of the team
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select()
      .match({ team_id: parseInt(teamId), user_id: req.user.id })
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    next();
  } catch (err) {
    console.error('Membership check error:', {
      message: err.message,
      code: err.code,
      details: err.details,
    });
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /tasks
router.post(
  '/',
  isAuthenticated,
  [
    body('title').notEmpty().trim().withMessage('Title is required'),
    body('team_id').isInt().withMessage('Team ID must be an integer'),
    body('assigned_to_id')
      .optional()
      .isInt()
      .withMessage('Assigned To ID must be an integer'),
    body('due_date')
      .optional()
      .isISO8601()
      .withMessage('Due date must be a valid ISO 8601 date'),
  ],
  isTeamMember,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, team_id, assigned_to_id, due_date } = req.body;

    try {
      // Verify team exists
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('id')
        .eq('id', parseInt(team_id))
        .single();

      if (teamError || !team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      // Verify assigned_to_id is a team member
      if (assigned_to_id) {
        const { data: assigneeMembership, error: assigneeError } = await supabase
          .from('memberships')
          .select()
          .match({ team_id: parseInt(team_id), user_id: parseInt(assigned_to_id) })
          .maybeSingle();

        if (assigneeError) throw assigneeError;
        if (!assigneeMembership) {
          return res.status(400).json({ error: 'Assigned user must be a team member' });
        }
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .insert([
          {
            title,
            description: description || null,
            team_id: parseInt(team_id),
            assigned_to_id: assigned_to_id ? parseInt(assigned_to_id) : null,
            assigned_by_id: req.user.id,
            created_by: req.user.id,
            due_date: due_date || null,
            status: 'To Do',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(task);
    } catch (err) {
      console.error('Create task error:', {
        message: err.message,
        code: err.code,
        details: err.details,
      });
      res.status(500).json({ error: 'Failed to create task' });
    }
  }
);

// GET /tasks
router.get(
  '/',
  isAuthenticated,
  [
    query('team_id')
      .optional()
      .isInt()
      .withMessage('Team ID must be an integer'),
    query('assigned_to_id')
      .optional()
      .isInt()
      .withMessage('Assigned To ID must be an integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { team_id, assigned_to_id } = req.query;

    try {
      // Get all team_ids for the user
      const { data: memberships, error: membershipError } = await supabase
        .from('memberships')
        .select('team_id')
        .eq('user_id', req.user.id);

      if (membershipError) throw membershipError;

      const teamIds = memberships.map((m) => m.team_id);

      if (!teamIds.length) {
        return res.json([]); // Return empty array if user has no teams
      }

      let query = supabase.from('tasks').select('*').in('team_id', teamIds);

      if (team_id) {
        // Verify team_id is one of the user's teams
        if (!teamIds.includes(parseInt(team_id))) {
          return res.status(403).json({ error: 'You are not a member of this team' });
        }
        query = query.eq('team_id', parseInt(team_id));
      }
      if (assigned_to_id) {
        query = query.eq('assigned_to_id', parseInt(assigned_to_id));
      }

      const { data: tasks, error } = await query;

      if (error) throw error;

      res.json(tasks || []);
    } catch (err) {
      console.error('Fetch tasks error:', {
        message: err.message,
        code: err.code,
        details: err.details,
      });
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }
);

// PUT /tasks/:id
router.put(
  '/:id',
  isAuthenticated,
  [
    body('title')
      .optional()
      .notEmpty()
      .trim()
      .withMessage('Title cannot be empty'),
    body('assigned_to_id')
      .optional()
      .isInt()
      .withMessage('Assigned To ID must be an integer'),
    body('due_date')
      .optional()
      .isISO8601()
      .withMessage('Due date must be a valid ISO 8601 date'),
    body('status')
      .optional()
      .isIn(['To Do', 'In Progress', 'Done'])
      .withMessage('Status must be one of: To Do, In Progress, Done'),
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
      // Verify task exists
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id, team_id')
        .eq('id', parseInt(id))
        .single();

      if (taskError || !task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Verify assigned_to_id is a team member
      if (assigned_to_id) {
        const { data: assigneeMembership, error: assigneeError } = await supabase
          .from('memberships')
          .select()
          .match({ team_id: task.team_id, user_id: parseInt(assigned_to_id) })
          .maybeSingle();

        if (assigneeError) throw assigneeError;
        if (!assigneeMembership) {
          return res.status(400).json({ error: 'Assigned user must be a member of the team' });
        }
      }

      // Prepare update payload
      const updatePayload = {};
      if (title) updatePayload.title = title;
      if (description !== undefined) updatePayload.description = description || null;
      if (assigned_to_id !== undefined) updatePayload.assigned_to_id = parseInt(assigned_to_id) || null;
      if (due_date !== undefined) updatePayload.due_date = due_date || null;
      if (status) updatePayload.status = status;

      const { error: updateError } = await supabase
        .from('tasks')
        .update(updatePayload)
        .eq('id', parseInt(id));

      if (updateError) throw updateError;

      const { data: updatedTask, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', parseInt(id))
        .single();

      if (fetchError) throw fetchError;

      res.json(updatedTask);
    } catch (err) {
      console.error('Update task error:', {
        message: err.message,
        code: err.code,
        details: err.details,
      });
      res.status(500).json({ error: 'Failed to update task' });
    }
  }
);

// DELETE /tasks/:id
router.delete('/:id', isAuthenticated, isTeamMember, async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('tasks').delete().eq('id', parseInt(id));
    if (error) throw error;

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Delete task error:', {
      message: err.message,
      code: err.code,
      details: err.details,
    });
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
