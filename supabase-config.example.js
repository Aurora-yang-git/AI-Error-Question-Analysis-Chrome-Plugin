// Supabase Configuration Template
// Copy this file to supabase-config.js and fill in your own values
// The supabase-config.js file is gitignored for security

const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

export const supabaseConfig = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY
};

// Note: This extension can work without Supabase configuration.
// If supabase-config.js is not present or configured, the extension will run in local-only mode.
// Features that require Supabase (cloud sync, recommended analyses) will be disabled.

