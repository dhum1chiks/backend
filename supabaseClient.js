// backend/supabaseClient.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ytxlpnnspalwomzivplc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0eGxwbm5zcGFsd29teml2cGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyNDIzMjgsImV4cCI6MjA2NDgxODMyOH0.syswdeIfbzHItvLxzhxTKxjaYjlJh3JTtV_JvYM7uFo'
);

module.exports = supabase;

