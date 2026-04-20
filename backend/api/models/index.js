// No ORM — tables are accessed via the supabase client directly.
// Import supabase from here or from config/db.js directly.
const supabase = require('../config/db');

module.exports = { supabase };
