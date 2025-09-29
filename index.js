const express = require('express');
const app = express();

// Basic middleware
app.use(express.json());

// CORS - allow specific origins with credentials
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3002',
    'https://frontend-alpha-seven-16.vercel.app'
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Simple routes
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running!', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/test', (req, res) => {
  res.json({
    message: 'Test endpoint working',
    origin: req.get('Origin'),
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
});

// Mock auth for testing
app.post('/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);

  // Simple mock authentication
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Email and password are required'
    });
  }

  // Mock successful login
  res.json({
    success: true,
    message: 'Login successful',
    user: {
      id: 1,
      username: 'testuser',
      email: email
    },
    token: 'mock-jwt-token-' + Date.now(),
    timestamp: new Date().toISOString()
  });
});

app.post('/auth/register', (req, res) => {
  console.log('Register attempt:', req.body);

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({
      error: 'Username, email, and password are required'
    });
  }

  // Mock successful registration
  res.status(201).json({
    success: true,
    message: 'Registration successful',
    user: {
      id: 1,
      username: username,
      email: email
    },
    token: 'mock-jwt-token-' + Date.now(),
    timestamp: new Date().toISOString()
  });
});

app.post('/teams', (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  const newTeam = {
    id: Date.now(),
    name,
    created_by: 1, // Mock current user
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  res.status(201).json(newTeam);
});

app.delete('/teams/:id', (req, res) => {
  const { id } = req.params;
  // Mock: only allow creator to delete
  res.json({ message: 'Team deleted successfully' });
});

app.post('/teams/:id/members', (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const newMember = {
    team_id: parseInt(id),
    user_id: parseInt(user_id),
    created_at: new Date().toISOString()
  };

  res.status(201).json(newMember);
});

app.delete('/teams/:teamId/members/:userId', (req, res) => {
  const { teamId, userId } = req.params;
  res.json({ message: 'Member removed successfully' });
});

app.post('/teams/:id/invite', (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const invitation = {
    id: Date.now(),
    team_id: parseInt(id),
    inviter_id: 1,
    invitee_email: email,
    status: 'pending',
    created_at: new Date().toISOString()
  };

  res.status(201).json(invitation);
});

// Mock API endpoints
app.get('/teams', (req, res) => {
  res.json([
    {
      id: 1,
      name: 'Development Team',
      created_by: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      name: 'Design Team',
      created_by: 1,
      created_at: new Date().toISOString()
    }
  ]);
});

app.get('/teams/:id/members', (req, res) => {
  res.json([
    {
      id: 1,
      user_id: 1,
      team_id: parseInt(req.params.id),
      username: 'testuser',
      email: 'test@example.com',
      created_at: new Date().toISOString()
    }
  ]);
});

app.post('/tasks/create-task', (req, res) => {
  const { title, description, team_id, assigned_to_id, due_date, priority, milestone_id } = req.body;

  if (!title || !team_id) {
    return res.status(400).json({ error: 'Title and team_id are required' });
  }

  const newTask = {
    id: Date.now(),
    title,
    description: description || '',
    team_id: parseInt(team_id),
    assigned_to_id: assigned_to_id ? parseInt(assigned_to_id) : null,
    assigned_by_id: 1, // Mock current user
    created_by: 1,
    due_date,
    status: 'To Do',
    priority: priority || 'Medium',
    milestone_id: milestone_id ? parseInt(milestone_id) : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  res.status(201).json(newTask);
});

app.put('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const updatedTask = {
    id: parseInt(id),
    ...updates,
    updated_at: new Date().toISOString()
  };

  res.json(updatedTask);
});

app.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;
  res.json({ message: 'Task deleted successfully' });
});

app.get('/tasks/get-task', (req, res) => {
  const { team_id, assigned_to_id, status, priority } = req.query;

  let tasks = [
    {
      id: 1,
      title: 'Test Task',
      description: 'This is a test task',
      team_id: 1,
      assigned_to_id: 1,
      status: 'To Do',
      priority: 'Medium',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      title: 'Implement Login',
      description: 'User authentication feature',
      team_id: 1,
      assigned_to_id: 1,
      status: 'In Progress',
      priority: 'High',
      created_at: new Date().toISOString()
    },
    {
      id: 3,
      title: 'Design Dashboard',
      description: 'Create responsive dashboard UI',
      team_id: 1,
      assigned_to_id: null,
      status: 'Done',
      priority: 'Medium',
      created_at: new Date().toISOString()
    }
  ];

  // Apply filters
  if (team_id) {
    tasks = tasks.filter(task => task.team_id === parseInt(team_id));
  }
  if (assigned_to_id) {
    tasks = tasks.filter(task => task.assigned_to_id === parseInt(assigned_to_id));
  }
  if (status) {
    tasks = tasks.filter(task => task.status === status);
  }
  if (priority) {
    tasks = tasks.filter(task => task.priority === priority);
  }

  res.json(tasks);
});

app.get('/tasks/time/active', (req, res) => {
  // Return null for no active timer
  res.json(null);
});

app.post('/tasks/:id/attachments', (req, res) => {
  const { id } = req.params;

  // Mock file upload - in real implementation, this would handle multipart/form-data
  const mockFile = {
    id: Date.now(),
    task_id: parseInt(id),
    filename: 'document.pdf',
    original_name: 'Project_Document.pdf',
    path: `/uploads/tasks/${id}/document.pdf`,
    mimetype: 'application/pdf',
    size: 245760, // 240KB
    uploaded_by: 1,
    created_at: new Date().toISOString()
  };

  res.status(201).json(mockFile);
});

app.get('/tasks/:id/attachments', (req, res) => {
  const { id } = req.params;

  res.json([
    {
      id: 1,
      task_id: parseInt(id),
      filename: 'requirements.pdf',
      original_name: 'Project_Requirements.pdf',
      path: `/uploads/tasks/${id}/requirements.pdf`,
      mimetype: 'application/pdf',
      size: 512000, // 500KB
      uploaded_by: 1,
      username: 'testuser',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
    },
    {
      id: 2,
      task_id: parseInt(id),
      filename: 'mockup.png',
      original_name: 'UI_Mockup.png',
      path: `/uploads/tasks/${id}/mockup.png`,
      mimetype: 'image/png',
      size: 1024000, // 1MB
      uploaded_by: 1,
      username: 'testuser',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
    }
  ]);
});

app.delete('/attachments/:id', (req, res) => {
  const { id } = req.params;
  res.json({ message: 'Attachment deleted successfully' });
});

app.post('/tasks/:id/comments', (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Comment content is required' });
  }

  const newComment = {
    id: Date.now(),
    task_id: parseInt(id),
    user_id: 1,
    content,
    created_at: new Date().toISOString()
  };

  res.status(201).json(newComment);
});

app.get('/tasks/:id/comments', (req, res) => {
  const { id } = req.params;

  res.json([
    {
      id: 1,
      task_id: parseInt(id),
      user_id: 1,
      username: 'testuser',
      content: 'This task looks good to start working on.',
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
    },
    {
      id: 2,
      task_id: parseInt(id),
      user_id: 1,
      username: 'testuser',
      content: 'I\'ve completed the initial implementation. Please review.',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
    }
  ]);
});

app.get('/tasks/:id/time', (req, res) => {
  res.json({ logs: [], totalMinutes: 0, totalHours: 0 });
});

app.post('/tasks/:id/time/start', (req, res) => {
  const { id } = req.params;
  const { description } = req.body;

  const mockTimer = {
    id: Date.now(),
    task_id: parseInt(id),
    user_id: 1,
    start_time: new Date().toISOString(),
    description: description || null,
    is_active: true,
    created_at: new Date().toISOString()
  };

  res.json(mockTimer);
});

app.post('/tasks/:id/time/stop', (req, res) => {
  const { id } = req.params;

  const mockStoppedTimer = {
    id: Date.now(),
    task_id: parseInt(id),
    user_id: 1,
    start_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    end_time: new Date().toISOString(),
    duration_minutes: 30,
    description: 'Mock timer session',
    is_active: false,
    created_at: new Date().toISOString()
  };

  res.json(mockStoppedTimer);
});

app.delete('/tasks/time/:logId', (req, res) => {
  const { logId } = req.params;
  // Mock successful deletion
  res.json({ message: 'Time log deleted successfully' });
});

app.get('/users', (req, res) => {
  res.json([
    { id: 1, username: 'testuser', email: 'test@example.com' }
  ]);
});

app.put('/users/profile', (req, res) => {
  const updates = req.body;

  const updatedProfile = {
    id: 1,
    username: updates.username || 'testuser',
    email: updates.email || 'test@example.com',
    bio: updates.bio || 'Test user',
    phone: updates.phone,
    timezone: updates.timezone || 'UTC',
    notification_settings: updates.notification_settings || { email: true, push: true, reminders: true },
    theme_settings: updates.theme_settings || { theme: 'light', color: 'green' },
    avatar_url: updates.avatar_url,
    updated_at: new Date().toISOString()
  };

  res.json(updatedProfile);
});

app.get('/users/profile', (req, res) => {
  res.json({
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    bio: 'Experienced full-stack developer passionate about creating efficient and user-friendly applications.',
    phone: '+1-555-0123',
    timezone: 'America/New_York',
    avatar_url: null,
    notification_settings: { email: true, push: true, reminders: true },
    theme_settings: { theme: 'light', color: 'green' },
    created_at: new Date().toISOString()
  });
});

app.get('/task-templates', (req, res) => {
  res.json([
    {
      id: 1,
      name: 'Bug Report',
      title_template: '🐛 Bug: [Brief description]',
      description_template: '## Description\n[Describe the bug]\n\n## Steps to Reproduce\n1. [Step 1]\n2. [Step 2]\n3. [Step 3]\n\n## Expected Behavior\n[What should happen]\n\n## Actual Behavior\n[What actually happens]\n\n## Environment\n- Browser: [Browser name]\n- OS: [Operating system]',
      priority: 'High',
      status: 'To Do',
      is_default: true
    },
    {
      id: 2,
      name: 'Feature Request',
      title_template: '✨ Feature: [Feature name]',
      description_template: '## Summary\n[Brief summary of the feature]\n\n## Problem\n[What problem does this solve?]\n\n## Solution\n[Describe the proposed solution]\n\n## Alternatives\n[Alternative solutions considered]\n\n## Additional Context\n[Any additional information]',
      priority: 'Medium',
      status: 'To Do',
      is_default: true
    },
    {
      id: 3,
      name: 'Meeting',
      title_template: '📅 Meeting: [Meeting topic]',
      description_template: '## Meeting Details\n- **Date & Time:** [Date and time]\n- **Location:** [Physical or virtual location]\n- **Attendees:** [List of attendees]\n\n## Agenda\n1. [Topic 1]\n2. [Topic 2]\n3. [Topic 3]\n\n## Notes\n[Meeting notes will be added here]',
      priority: 'Medium',
      status: 'To Do',
      is_default: true
    }
  ]);
});

app.get('/teams/invitations', (req, res) => {
  res.json([]);
});

app.get('/teams/:id/messages', (req, res) => {
  res.json([]);
});

app.post('/teams/:id/messages', (req, res) => {
  res.json({
    id: Date.now(),
    team_id: parseInt(req.params.id),
    user_id: 1,
    message: req.body.message || 'Test message',
    created_at: new Date().toISOString()
  });
});

app.post('/milestones', (req, res) => {
  const { title, description, team_id, due_date, priority } = req.body;

  if (!title || !team_id) {
    return res.status(400).json({ error: 'Title and team_id are required' });
  }

  const newMilestone = {
    id: Date.now(),
    title,
    description: description || '',
    team_id: parseInt(team_id),
    created_by: 1,
    due_date,
    status: 'Not Started',
    priority: priority || 'Medium',
    progress_percentage: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  res.status(201).json(newMilestone);
});

app.put('/milestones/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const updatedMilestone = {
    id: parseInt(id),
    ...updates,
    updated_at: new Date().toISOString()
  };

  res.json(updatedMilestone);
});

app.delete('/milestones/:id', (req, res) => {
  const { id } = req.params;
  res.json({ message: 'Milestone deleted successfully' });
});

app.get('/milestones', (req, res) => {
  res.json([
    {
      id: 1,
      title: 'Q4 Product Launch',
      description: 'Launch the new product features',
      team_id: 1,
      created_by: 1,
      due_date: '2025-12-31',
      status: 'In Progress',
      priority: 'High',
      progress_percentage: 65,
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      title: 'Security Audit',
      description: 'Complete security review and fixes',
      team_id: 1,
      created_by: 1,
      due_date: '2025-11-15',
      status: 'Not Started',
      priority: 'High',
      progress_percentage: 0,
      created_at: new Date().toISOString()
    }
  ]);
});

app.get('/tasks/reminders', (req, res) => {
  res.json([]);
});

// Export for Vercel
module.exports = app;

// Export for Vercel serverless functions
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} with Pusher real-time features`);
  });
}
