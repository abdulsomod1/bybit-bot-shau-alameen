/**
 * Test script - Check Supabase connection and table status
 * Run: node test-connection.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n=== Supabase Connection Test ===\n');

// Check env vars
if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL is not set in .env');
  process.exit(1);
}

if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === '<PASTE-SERVICE-ROLE-KEY-HERE>') {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is missing or is placeholder in .env');
  console.error('   Fix: Edit c:\\bot\\.env and replace with your real service role key');
  process.exit(1);
}

// Create admin client
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const tables = ['bot_settings', 'bot_state', 'api_credentials', 'pricing_rules', 'ads', 'activity_logs', 'competitor_rankings'];

console.log('Checking tables...\n');

let allOk = true;
for (const table of tables) {
  try {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
      allOk = false;
    } else {
      console.log(`✅ ${table}: OK`);
    }
  } catch (e: any) {
    console.log(`❌ ${table}: ${e.message}`);
    allOk = false;
  }
}

console.log('');
if (allOk) {
  console.log('✅ All tables exist! Connection is working.\n');
  console.log('Restart the bot with: python launch.py');
} else {
  console.log('❌ Some tables are missing.\n');
  console.log('=== FIX REQUIRED ===');
  console.log('\n1. Go to Supabase Dashboard:');
  console.log('   https://supabase.com/dashboard/project/esnciydnbkanyxhjpvlk/sql');
  console.log('\n2. Copy contents of c:\\bot\\supabase\\schema.sql');
  console.log('\n3. Paste and RUN in SQL Editor');
  console.log('\n4. Then run this test again: node test-connection.js\n');
}

console.log('=== Test Complete ===\n');