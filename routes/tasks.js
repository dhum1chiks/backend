const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { isAuthenticated, isTeamMember } = require('../middleware/isAuthenticated');
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

// Middleware to check if user has access to task operations
const canAccessTask = async (req, res, next) => {
  try {
    const { team_id } = req.body;
    const { id: taskId } = req.params;
    let teamId = team_id;

    if (!teamId && taskId) {
      const { data: task, error } = await supabase
        .from('tasks')
        .select('team_id, created_by, assigned_to_id')
        .eq('id', taskId)
        .single();

      if (error || !task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      teamId = task.team_id;

      // Allow access if user created the task, is assigned to it, or is a team member
      const hasAccess = task.created_by === req.user.id ||
                       task.assigned_to_id === req.user.id;

      if (hasAccess) {
        console.log('User has direct access to task (creator or assignee)');
        return next();
      }
    }

    if (!teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }

    // Check team membership
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
        return res.status(403).json({ error: 'You do not have access to this task' });
      }
      console.log('User is team creator, allowing access');
    }
    next();
  } catch (err) {
    console.error('Task access check error:', err);
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
        // Check if the current user is the team creator
        const { data: team, error: teamError } = await supabase
          .from('teams')
          .select('created_by')
          .eq('id', team_id)
          .single();

        const isTeamCreator = !teamError && team.created_by === req.user.id;

        if (isTeamCreator) {
          // Team creators can assign tasks to anyone
          console.log('Team creator assigning task - allowing assignment to any user');
        } else {
          // Non-creators can only assign to themselves if they're a team member
          if (assigned_to_id === req.user.id) {
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
      // Get user's team memberships
      const { data: memberships, error: membershipError } = await supabase
        .from('memberships')
        .select('team_id')
        .eq('user_id', req.user.id);

      if (membershipError) {
        console.error('Membership fetch error:', membershipError);
        return res.status(500).json({ error: 'Failed to fetch tasks' });
      }

      // Also get teams where user is the creator
      const { data: createdTeams, error: createdTeamsError } = await supabase
        .from('teams')
        .select('id')
        .eq('created_by', req.user.id);

      if (createdTeamsError) {
        console.error('Created teams fetch error:', createdTeamsError);
        return res.status(500).json({ error: 'Failed to fetch tasks' });
      }

      // Combine team IDs from memberships and created teams
      const membershipTeamIds = memberships ? memberships.map(m => m.team_id) : [];
      const createdTeamIds = createdTeams ? createdTeams.map(t => t.id) : [];
      const allTeamIds = [...new Set([...membershipTeamIds, ...createdTeamIds])];

      if (allTeamIds.length === 0) {
        return res.json([]);
      }

      let taskQuery = supabase
        .from('tasks')
        .select('*')
        .in('team_id', allTeamIds);

      if (team_id) {
        // If specific team requested, ensure user has access to it
        if (!allTeamIds.includes(parseInt(team_id))) {
          return res.status(403).json({ error: 'You do not have access to this team' });
        }
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

      res.json(tasks || []);
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
router.post('/:id/attachments', isAuthenticated, canAccessTask, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { id } = req.params;
    const { filename, originalname, path: filePath, mimetype, size } = req.file;

    const { data: attachment, error } = await supabase
      .from('attachments')
      .insert({
        task_id: parseInt(id),
        filename,
        original_name: originalname,
        path: filePath,
        mimetype,
        size,
        uploaded_by: req.user.id
      })
      .select('*')
      .single();

    if (error) {
      console.error('Upload attachment error:', error);
      return res.status(500).json({ error: 'Failed to upload attachment' });
    }

    res.status(201).json(attachment);
  } catch (err) {
    console.error('Upload attachment error:', err);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

// Get attachments for task
router.get('/:id/attachments', isAuthenticated, canAccessTask, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: attachments, error } = await supabase
      .from('attachments')
      .select(`
        *,
        users!attachments_uploaded_by_fkey (
          username
        )
      `)
      .eq('task_id', parseInt(id));

    if (error) {
      console.error('Get attachments error:', error);
      return res.status(500).json({ error: 'Failed to get attachments' });
    }

    // Format the response to match the expected structure
    const formattedAttachments = attachments.map(attachment => ({
      ...attachment,
      uploaded_by_name: attachment.users?.username
    }));

    res.json(formattedAttachments);
  } catch (err) {
    console.error('Get attachments error:', err);
    res.status(500).json({ error: 'Failed to get attachments' });
  }
});

// Delete attachment
router.delete('/attachments/:attachmentId', isAuthenticated, async (req, res) => {
  try {
    const { attachmentId } = req.params;

    const { data: attachment, error: fetchError } = await supabase
      .from('attachments')
      .select('*')
      .eq('id', parseInt(attachmentId))
      .single();

    if (fetchError || !attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Check if user uploaded it or is team member
    if (attachment.uploaded_by !== req.user.id) {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('team_id')
        .eq('id', attachment.task_id)
        .single();

      if (taskError || !task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const { data: membership, error: membershipError } = await supabase
        .from('memberships')
        .select('id')
        .eq('team_id', task.team_id)
        .eq('user_id', req.user.id)
        .single();

      if (membershipError || !membership) {
        return res.status(403).json({ error: 'Not authorized to delete this attachment' });
      }
    }

    // Delete file from disk
    fs.unlinkSync(attachment.path);

    const { error: deleteError } = await supabase
      .from('attachments')
      .delete()
      .eq('id', parseInt(attachmentId));

    if (deleteError) {
      console.error('Delete attachment error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete attachment' });
    }

    res.json({ message: 'Attachment deleted' });
  } catch (err) {
    console.error('Delete attachment error:', err);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

// Get comments for task
router.get('/:id/comments', isAuthenticated, canAccessTask, async (req, res) => {
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
router.post('/:id/comments', isAuthenticated, canAccessTask, async (req, res) => {
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
    const { data: templates, error } = await supabase
      .from('task_templates')
      .select('*')
      .or(`is_default.eq.true,created_by.eq.${req.user.id}`)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('Get templates error:', error);
      return res.status(500).json({ error: 'Failed to get templates' });
    }

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
    const { data: template, error } = await supabase
      .from('task_templates')
      .insert({
        name,
        title_template,
        description_template,
        priority: priority || 'Medium',
        status: status || 'To Do',
        created_by: req.user.id,
        is_default: false
      })
      .select('*')
      .single();

    if (error) {
      console.error('Create template error:', error);
      return res.status(500).json({ error: 'Failed to create template' });
    }

    res.status(201).json(template);
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Delete a custom task template
router.delete('/templates/:id', isAuthenticated, async (req, res) => {
  try {
    const { data: template, error: fetchError } = await supabase
      .from('task_templates')
      .select('*')
      .eq('id', parseInt(req.params.id))
      .single();

    if (fetchError || !template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (template.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Can only delete your own templates' });
    }

    const { error: deleteError } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', parseInt(req.params.id));

    if (deleteError) {
      console.error('Delete template error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete template' });
    }

    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Start time tracking for a task
router.post('/:id/time/start', isAuthenticated, canAccessTask, async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;

    // Check if user already has an active timer for this task
    const { data: activeTimer, error: activeError } = await supabase
      .from('time_logs')
      .select('*')
      .eq('task_id', parseInt(id))
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (activeTimer && !activeError) {
      return res.status(400).json({ error: 'Timer already running for this task' });
    }

    // Stop any other active timers for this user
    const { error: stopError } = await supabase
      .from('time_logs')
      .update({
        is_active: false,
        end_time: new Date().toISOString(),
        duration_minutes: 0 // Will be calculated when stopped
      })
      .eq('user_id', req.user.id)
      .eq('is_active', true);

    if (stopError) {
      console.error('Stop other timers error:', stopError);
    }

    // Start new timer
    const { data: timeLog, error: insertError } = await supabase
      .from('time_logs')
      .insert({
        task_id: parseInt(id),
        user_id: req.user.id,
        start_time: new Date().toISOString(),
        description: description || null,
        is_active: true
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Start timer error:', insertError);
      return res.status(500).json({ error: 'Failed to start timer' });
    }

    res.status(201).json(timeLog);
  } catch (err) {
    console.error('Start timer error:', err);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

// Stop time tracking for a task
router.post('/:id/time/stop', isAuthenticated, canAccessTask, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: activeTimer, error: fetchError } = await supabase
      .from('time_logs')
      .select('*')
      .eq('task_id', parseInt(id))
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (fetchError || !activeTimer) {
      return res.status(400).json({ error: 'No active timer found for this task' });
    }

    // Calculate duration
    const startTime = new Date(activeTimer.start_time);
    const endTime = new Date();
    const durationMinutes = Math.floor((endTime - startTime) / (1000 * 60));

    const { data: updatedLog, error: updateError } = await supabase
      .from('time_logs')
      .update({
        end_time: endTime.toISOString(),
        is_active: false,
        duration_minutes: durationMinutes
      })
      .eq('id', activeTimer.id)
      .select('*')
      .single();

    if (updateError) {
      console.error('Stop timer error:', updateError);
      return res.status(500).json({ error: 'Failed to stop timer' });
    }

    res.json(updatedLog);
  } catch (err) {
    console.error('Stop timer error:', err);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

// Get time logs for a task
router.get('/:id/time', isAuthenticated, canAccessTask, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: timeLogs, error } = await supabase
      .from('time_logs')
      .select(`
        *,
        users!time_logs_user_id_fkey (
          username
        )
      `)
      .eq('task_id', parseInt(id))
      .order('start_time', { ascending: false });

    if (error) {
      console.error('Get time logs error:', error);
      return res.status(500).json({ error: 'Failed to get time logs' });
    }

    // Calculate total time spent
    const totalMinutes = timeLogs.reduce((sum, log) => {
      return sum + (log.duration_minutes || 0);
    }, 0);

    // Format the response to match the expected structure
    const formattedLogs = timeLogs.map(log => ({
      ...log,
      username: log.users?.username
    }));

    res.json({
      logs: formattedLogs,
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

    const { data: timeLog, error: fetchError } = await supabase
      .from('time_logs')
      .select('*')
      .eq('id', parseInt(logId))
      .single();

    if (fetchError || !timeLog) {
      return res.status(404).json({ error: 'Time log not found' });
    }

    if (timeLog.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own time logs' });
    }

    const { error: deleteError } = await supabase
      .from('time_logs')
      .delete()
      .eq('id', parseInt(logId));

    if (deleteError) {
      console.error('Delete time log error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete time log' });
    }

    res.json({ message: 'Time log deleted' });
  } catch (err) {
    console.error('Delete time log error:', err);
    res.status(500).json({ error: 'Failed to delete time log' });
  }
});

module.exports = router;
