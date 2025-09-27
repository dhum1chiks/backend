const supabase = require('./supabaseClient');

// Export the supabase client as db for compatibility with existing routes
module.exports = {
  db: supabase
};