// middleware/isAuthenticated.js
const jwt = require('jsonwebtoken');
const supabase = require('../supabaseClient');

function isAuthenticated(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token;

  // Safely extract token from Authorization header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.replace(/^Bearer\s+/, '');
  }

  if (!token) {
    console.warn(`Authentication failed: No token provided for ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Validate token payload
    if (!decoded.id || !decoded.email) {
      console.warn(`Authentication failed: Invalid token payload for ${req.method} ${req.originalUrl}`);
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
    };

    console.debug(`Authenticated user: ${req.user.id} (${req.user.email}) for ${req.method} ${req.originalUrl}`);
    next();
  } catch (error) {
    console.error(`JWT verification failed for ${req.method} ${req.originalUrl}: ${error.name} - ${error.message}`);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware to check if user is a member of the team or team creator
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

    // Check if user is a team member
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', req.user.id)
      .single();

    if (membership && !membershipError) {
      // User is a member of the team
      return next();
    }

    // Check if user is the creator of the team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('created_by')
      .eq('id', teamId)
      .single();

    if (team && team.created_by === req.user.id) {
      // User is the creator of the team
      return next();
    }

    return res.status(403).json({ error: 'You are not a member of this team' });
  } catch (err) {
    console.error('Team membership check error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { isAuthenticated, isTeamMember };

