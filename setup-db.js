// Database setup script for Supabase
// Run this script to create missing tables

const supabase = require('./supabaseClient');

async function setupDatabase() {
  console.log('Setting up database tables...');

  try {
    // Create team_messages table
    console.log('Creating team_messages table...');
    const { error: messagesError } = await supabase.rpc('create_team_messages_table', {});
    if (messagesError && !messagesError.message.includes('already exists')) {
      console.error('Error creating team_messages table:', messagesError);
    } else {
      console.log('team_messages table created or already exists');
    }

    // Create invitations table
    console.log('Creating invitations table...');
    const { error: invitationsError } = await supabase.rpc('create_invitations_table', {});
    if (invitationsError && !invitationsError.message.includes('already exists')) {
      console.error('Error creating invitations table:', invitationsError);
    } else {
      console.log('invitations table created or already exists');
    }

    // Create comments table
    console.log('Creating comments table...');
    const { error: commentsError } = await supabase.rpc('create_comments_table', {});
    if (commentsError && !commentsError.message.includes('already exists')) {
      console.error('Error creating comments table:', commentsError);
    } else {
      console.log('comments table created or already exists');
    }

    // Create attachments table
    console.log('Creating attachments table...');
    const { error: attachmentsError } = await supabase.rpc('create_attachments_table', {});
    if (attachmentsError && !attachmentsError.message.includes('already exists')) {
      console.error('Error creating attachments table:', attachmentsError);
    } else {
      console.log('attachments table created or already exists');
    }

    // Create time_logs table
    console.log('Creating time_logs table...');
    const { error: timeLogsError } = await supabase.rpc('create_time_logs_table', {});
    if (timeLogsError && !timeLogsError.message.includes('already exists')) {
      console.error('Error creating time_logs table:', timeLogsError);
    } else {
      console.log('time_logs table created or already exists');
    }

    console.log('Database setup completed!');
  } catch (error) {
    console.error('Database setup failed:', error);
  }
}

// SQL to run in Supabase SQL Editor if RPC functions don't work:
/*
-- Create team_messages table
CREATE TABLE IF NOT EXISTS team_messages (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, invitee_id, status)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  path VARCHAR(500) NOT NULL,
  mimetype VARCHAR(100),
  size INTEGER,
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create time_logs table
CREATE TABLE IF NOT EXISTS time_logs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes DECIMAL(10,2),
  description TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_team_messages_team_id ON team_messages(team_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_created_at ON team_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee_id ON invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_comments_task_id ON comments(task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_task_id ON time_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user_id ON time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_active ON time_logs(is_active) WHERE is_active = true;
*/

if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };