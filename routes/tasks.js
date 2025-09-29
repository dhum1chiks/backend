const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { isAuthenticated } = require('../middleware/isAuthenticated');
const { body, query, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Middleware to check if user is a member of the task's team
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

      if (error || !task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      teamId = task.team_id;
    }

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    const { data: membership, error } = await supabase
      .from('memberships')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', req.user.id)
      .single();

    console.log('Team membership check:', {
      teamId,
      userId: req.user.id,
      membership,
      error
    });

    if (error || !membership) {
      console.log('User not member of team, checking if they created it...');
      // Check if user created the team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('created_by')
        .eq('id', teamId)
        .single();

      if (teamError || team.created_by !== req.user.id) {
        return res.status(403).json({ error: 'You are not a member of this team' });
      }
      console.log('User is team creator, allowing access');
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
    body('milestone_id').optional().isInt().withMessage('Milestone ID must be an integer'),
  ],
  isTeamMember,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, team_id, assigned_to_id, due_date, milestone_id } = req.body;

    try {
      if (assigned_to_id) {
        // Allow assigning to self if user is team creator
        if (assigned_to_id === req.user.id) {
          const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('created_by')
            .eq('id', team_id)
            .single();

          if (!teamError && team.created_by === req.user.id) {
            // User is assigning to themselves and they created the team - allow it
          } else {
            // Check if user is a member
            const { data: membership, error } = await supabase
              .from('memberships')
              .select('id')
              .eq('team_id', team_id)
              .eq('user_id', req.user.id)
              .single();

            if (error || !membership) {
              return res.status(400).json({ error: 'You must be a member of the team to assign tasks to yourself' });
            }
          }
        } else {
          // Check if assigned user is a member of the team
          const { data: assigneeMembership, error } = await supabase
            .from('memberships')
            .select('id')
            .eq('team_id', team_id)
            .eq('user_id', assigned_to_id)
            .single();

          if (error || !assigneeMembership) {
            return res.status(400).json({ error: 'Assigned user must be a member of the team' });
          }
        }
      }

      // Validate milestone if provided
      if (milestone_id) {
        const { data: milestone, error } = await supabase
          .from('milestones')
          .select('id')
          .eq('id', milestone_id)
          .eq('team_id', team_id)
          .single();

        if (error || !milestone) {
          return res.status(400).json({ error: 'Milestone must belong to the same team' });
        }
      }

      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          title,
          description,
          team_id,
          assigned_to_id,
          assigned_by_id: req.user.id, // Set the user who assigns the task
          created_by: req.user.id,
          due_date,
          milestone_id: milestone_id || null,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Create task error:', error);
        return res.status(500).json({ error: 'Failed to create task' });
      }

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
      let query = supabase
        .from('tasks')
        .select('tasks.*')
        .eq('memberships.user_id', req.user.id);

      // For joins, we need to handle differently in Supabase
      // First get user's team memberships
      const { data: memberships, error: membershipError } = await supabase
        .from('memberships')
        .select('team_id')
        .eq('user_id', req.user.id);

      if (membershipError) {
        console.error('Membership fetch error:', membershipError);
        return res.status(500).json({ error: 'Failed to fetch tasks' });
      }

      const teamIds = memberships.map(m => m.team_id);

      let taskQuery = supabase
        .from('tasks')
        .select('*')
        .in('team_id', teamIds);

      if (team_id) {
        taskQuery = taskQuery.eq('team_id', team_id);
      }
      if (assigned_to_id) {
        taskQuery = taskQuery.eq('assigned_to_id', assigned_to_id);
      }

      const { data: tasks, error } = await taskQuery;

      if (error) {
        console.error('Fetch tasks error:', error);
        return res.status(500).json({ error: 'Failed to fetch tasks' });
      }

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
    body('milestone_id').optional().isInt().withMessage('Milestone ID must be an integer'),
  ],
  isTeamMember,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { title, description, assigned_to_id, due_date, status, milestone_id } = req.body;

    try {
      // Get current task to validate team membership
      const { data: currentTask, error: taskError } = await supabase
        .from('tasks')
        .select('team_id, created_by')
        .eq('id', id)
        .single();

      if (taskError || !currentTask) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Check if user can update this task (task creator or team creator)
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('created_by')
        .eq('id', currentTask.team_id)
        .single();

      const canUpdate = currentTask.created_by === req.user.id || (team && team.created_by === req.user.id);

      if (!canUpdate) {
        // Check if user is a team member
        const { data: membership, error: membershipError } = await supabase
          .from('memberships')
          .select('id')
          .eq('team_id', currentTask.team_id)
          .eq('user_id', req.user.id)
          .single();

        if (membershipError || !membership) {
          return res.status(403).json({ error: 'You do not have permission to update this task' });
        }
      }

      if (assigned_to_id !== undefined) {
        // Allow assigning to self if user is team creator or task creator
        if (assigned_to_id === req.user.id) {
          // User is assigning to themselves - allow if they can update the task
        } else {
          // Check if assigned user is a member of the team
          const { data: assigneeMembership, error } = await supabase
            .from('memberships')
            .select('id')
            .eq('team_id', currentTask.team_id)
            .eq('user_id', assigned_to_id)
            .single();

          if (error || !assigneeMembership) {
            return res.status(400).json({ error: 'Assigned user must be a member of the team' });
          }
        }
      }

      // Validate milestone if provided
      if (milestone_id !== undefined) {
        const { data: milestone, error } = await supabase
          .from('milestones')
          .select('id')
          .eq('id', milestone_id)
          .eq('team_id', currentTask.team_id)
          .single();

        if (error || !milestone) {
          return res.status(400).json({ error: 'Milestone must belong to the same team' });
        }
      }

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (assigned_to_id !== undefined) updateData.assigned_to_id = assigned_to_id;
      if (due_date !== undefined) updateData.due_date = due_date;
      if (status !== undefined) updateData.status = status;
      if (milestone_id !== undefined) updateData.milestone_id = milestone_id;

      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Update task error:', updateError);
        return res.status(500).json({ error: 'Failed to update task' });
      }

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
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete task error:', error);
      return res.status(500).json({ error: 'Failed to delete task' });
    }

    res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Task due date reminders for logged-in user
router.get('/reminders', isAuthenticated, async (req, res) => {
  try {
    const today = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);

    const { data: upcoming, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to_id', req.user.id)
      .gte('due_date', today.toISOString().split('T')[0])
      .lte('due_date', threeDaysFromNow.toISOString().split('T')[0]);

    if (error) {
      console.error('Fetch reminders error:', error);
      return res.status(500).json({ error: 'Failed to fetch reminders' });
    }

    res.json(upcoming);
  } catch (err) {
    console.error('Fetch reminders error:', err);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// Upload attachment to task
router.post('/:id/attachments', isAuthenticated, isTeamMember, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { id } = req.params;
    const { filename, originalname, path: filePath, mimetype, size } = req.file;

    const [attachment] = await db('attachments')
      .insert({
        task_id: id,
        filename,
        original_name: originalname,
        path: filePath,
        mimetype,
        size,
        uploaded_by: req.user.id
      })
      .returning('*');

    res.status(201).json(attachment);
  } catch (err) {
    console.error('Upload attachment error:', err);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

// Get attachments for task
router.get('/:id/attachments', isAuthenticated, isTeamMember, async (req, res) => {
  try {
    const { id } = req.params;
    const attachments = await db('attachments')
      .where({ task_id: id })
      .join('users', 'attachments.uploaded_by', 'users.id')
      .select('attachments.*', 'users.username as uploaded_by_name');

    res.json(attachments);
  } catch (err) {
    console.error('Get attachments error:', err);
    res.status(500).json({ error: 'Failed to get attachments' });
  }
});

// Delete attachment
router.delete('/attachments/:attachmentId', isAuthenticated, async (req, res) => {
  try {
    const { attachmentId } = req.params;
    const attachment = await db('attachments').where({ id: attachmentId }).first();

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Check if user uploaded it or is team member
    if (attachment.uploaded_by !== req.user.id) {
      const task = await db('tasks').where({ id: attachment.task_id }).first();
      const membership = await db('memberships')
        .where({ team_id: task.team_id, user_id: req.user.id })
        .first();
      if (!membership) {
        return res.status(403).json({ error: 'Not authorized to delete this attachment' });
      }
    }

    // Delete file from disk
    fs.unlinkSync(attachment.path);

    await db('attachments').where({ id: attachmentId }).del();
    res.json({ message: 'Attachment deleted' });
  } catch (err) {
    console.error('Delete attachment error:', err);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// Get comments for task
router.get('/:id/comments', isAuthenticated, isTeamMember, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        *,
        users!comments_user_id_fkey (
          username
        )
      `)
      .eq('task_id', parseInt(id))
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Get comments error:', error);
      return res.status(500).json({ error: 'Failed to get comments' });
    }

    // Format the response to match the expected structure
    const formattedComments = comments.map(comment => ({
      ...comment,
      username: comment.users?.username
    }));

    res.json(formattedComments);
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Failed to get comments' });
  }
});

// Add comment to task
router.post('/:id/comments', isAuthenticated, isTeamMember, async (req, res) => {
  const { content } = req.body;
  try {
    const { id } = req.params;

    const { data: comment, error: insertError } = await supabase
      .from('comments')
      .insert({
        task_id: parseInt(id),
        user_id: req.user.id,
        content
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Add comment error:', insertError);
      return res.status(500).json({ error: 'Failed to add comment' });
    }

    // Get comment with user info
    const { data: commentWithUser, error: fetchError } = await supabase
      .from('comments')
      .select(`
        *,
        users!comments_user_id_fkey (
          username
        )
      `)
      .eq('id', comment.id)
      .single();

    if (fetchError) {
      console.error('Fetch comment error:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch comment' });
    }

    res.status(201).json({
      ...commentWithUser,
      username: commentWithUser.users?.username
    });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Delete comment
router.delete('/comments/:commentId', isAuthenticated, async (req, res) => {
  try {
    const { commentId } = req.params;

    // First check if comment exists and belongs to user
    const { data: comment, error: fetchError } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', parseInt(commentId))
      .single();

    if (fetchError || !comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (comment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('id', parseInt(commentId));

    if (deleteError) {
      console.error('Delete comment error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete comment' });
    }

    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Get all task templates (default + user created)
router.get('/templates', isAuthenticated, async (req, res) => {
  try {
    const templates = await db('task_templates')
      .where({ is_default: true })
      .orWhere({ created_by: req.user.id })
      .select('*')
      .orderBy('is_default', 'desc')
      .orderBy('name');
    res.json(templates);
  } catch (err) {
    console.error('Get templates error:', err);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

// Create a custom task template
router.post('/templates', isAuthenticated, async (req, res) => {
  const { name, title_template, description_template, priority, status } = req.body;
  try {
    const [template] = await db('task_templates')
      .insert({
        name,
        title_template,
        description_template,
        priority: priority || 'Medium',
        status: status || 'To Do',
        created_by: req.user.id,
        is_default: false
      })
      .returning('*');
    res.status(201).json(template);
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Delete a custom task template
router.delete('/templates/:id', isAuthenticated, async (req, res) => {
  try {
    const template = await db('task_templates').where({ id: req.params.id }).first();
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.created_by !== req.user.id) return res.status(403).json({ error: 'Can only delete your own templates' });

    await db('task_templates').where({ id: req.params.id }).del();
    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Start time tracking for a task
router.post('/:id/time/start', isAuthenticated, isTeamMember, async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;

    // Check if user already has an active timer for this task
    const activeTimer = await db('time_logs')
      .where({ task_id: id, user_id: req.user.id, is_active: true })
      .first();

    if (activeTimer) {
      return res.status(400).json({ error: 'Timer already running for this task' });
    }

    // Stop any other active timers for this user
    await db('time_logs')
      .where({ user_id: req.user.id, is_active: true })
      .update({
        is_active: false,
        end_time: db.fn.now(),
        duration_minutes: db.raw('EXTRACT(EPOCH FROM (NOW() - start_time)) / 60')
      });

    // Start new timer
    const [timeLog] = await db('time_logs')
      .insert({
        task_id: id,
        user_id: req.user.id,
        start_time: db.fn.now(),
        description: description || null,
        is_active: true
      })
      .returning('*');

    res.status(201).json(timeLog);
  } catch (err) {
    console.error('Start timer error:', err);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

// Stop time tracking for a task
router.post('/:id/time/stop', isAuthenticated, isTeamMember, async (req, res) => {
  try {
    const { id } = req.params;

    const activeTimer = await db('time_logs')
      .where({ task_id: id, user_id: req.user.id, is_active: true })
      .first();

    if (!activeTimer) {
      return res.status(400).json({ error: 'No active timer found for this task' });
    }

    const [updatedLog] = await db('time_logs')
      .where({ id: activeTimer.id })
      .update({
        end_time: db.fn.now(),
        is_active: false,
        duration_minutes: db.raw('EXTRACT(EPOCH FROM (NOW() - start_time)) / 60')
      })
      .returning('*');

    res.json(updatedLog);
  } catch (err) {
    console.error('Stop timer error:', err);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

// Get time logs for a task
router.get('/:id/time', isAuthenticated, isTeamMember, async (req, res) => {
  try {
    const { id } = req.params;
    const timeLogs = await db('time_logs')
      .where({ task_id: id })
      .join('users', 'time_logs.user_id', 'users.id')
      .select('time_logs.*', 'users.username')
      .orderBy('time_logs.start_time', 'desc');

    // Calculate total time spent
    const totalMinutes = timeLogs.reduce((sum, log) => {
      return sum + (log.duration_minutes || 0);
    }, 0);

    res.json({
      logs: timeLogs,
      totalMinutes: Math.round(totalMinutes),
      totalHours: Math.round(totalMinutes / 60 * 100) / 100
    });
  } catch (err) {
    console.error('Get time logs error:', err);
    res.status(500).json({ error: 'Failed to get time logs' });
  }
});

// Get active timer for current user
router.get('/time/active', isAuthenticated, async (req, res) => {
  try {
    const { data: activeTimer, error } = await supabase
      .from('time_logs')
      .select('time_logs.*, tasks.title as task_title')
      .eq('time_logs.user_id', req.user.id)
      .eq('time_logs.is_active', true)
      .join('tasks', { 'time_logs.task_id': 'tasks.id' })
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Get active timer error:', error);
      return res.status(500).json({ error: 'Failed to get active timer' });
    }

    res.json(activeTimer || null);
  } catch (err) {
    console.error('Get active timer error:', err);
    res.status(500).json({ error: 'Failed to get active timer' });
  }
});

// Delete a time log entry
router.delete('/time/:logId', isAuthenticated, async (req, res) => {
  try {
    const { logId } = req.params;
    const timeLog = await db('time_logs').where({ id: logId }).first();

    if (!timeLog) {
      return res.status(404).json({ error: 'Time log not found' });
    }

    if (timeLog.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own time logs' });
    }

    await db('time_logs').where({ id: logId }).del();
    res.json({ message: 'Time log deleted' });
  } catch (err) {
    console.error('Delete time log error:', err);
    res.status(500).json({ error: 'Failed to delete time log' });
  }
});

module.exports = router;
