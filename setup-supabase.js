/**
 * Setup Script - Creates all database tables in Supabase
 * Run: node setup-supabase.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Check required env vars
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n=== Bybit P2P Bot - Supabase Setup ===\n');

// Check env vars
if (!SUPABASE_URL) {
  console.error('❌ ERROR: SUPABASE_URL is not set in .env');
  process.exit(1);
}
console.log('✅ SUPABASE_URL:', SUPABASE_URL);

if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === '<PASTE-SERVICE-ROLE-KEY-HERE>') {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is not set or is still a placeholder in .env');
  console.error('   Please get your service role key from Supabase Dashboard → Settings → API');
  process.exit(1);
}
console.log('✅ SUPABASE_SERVICE_ROLE_KEY: SET (hidden)');

// Create admin client
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Read schema
const schemaPath = path.join(__dirname, 'supabase', 'schema.sql');
if (!fs.existsSync(schemaPath)) {
  console.error('❌ schema.sql not found at:', schemaPath);
  process.exit(1);
}

const schema = fs.readFileSync(schemaPath, 'utf8');
console.log('\n📄 Found schema.sql (' + schema.length + ' chars)');

// Split into statements that can be run individually
const statements = schema
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

// Run schema
console.log('\n🔧 Creating tables...');
let successCount = 0;
let errorCount = 0;

for (const statement of statements) {
  if (statement.startsWith('create extension') || 
      statement.startsWith('create table') || 
      statement.startsWith('alter table') ||
      statement.startsWith('create index') ||
      statement.startsWith('create policy') ||
      statement.startsWith('create trigger') ||
      statement.startsWith('create function') ||
      statement.startsWith('create or replace function') ||
      statement.startsWith('grant') ||
      statement.startsWith('insert')) {
    
    try {
      const { error } = await supabase.rpc('exec', { sql: statement + ';' }).catch(() => {
        // Try direct query for non-rpc calls
        return { error: null }; // Skip RPC for now
      });
      
      // For DDL statements, we need to use the Supabase SQL editor approach
      // But since we're using the REST API, we can only do DML operations
      // So we'll just verify the tables exist
      
    } catch (e) {
      // Skip errors for DDL statements that require special handling
    }
    successCount++;
  }
}

console.log('\n📊 Note: Due to API limitations, DDL statements need to be run manually.');
console.log('\n=== REQUIRED ACTION ===');
console.log('\n1. Go to your Supabase Dashboard:');
console.log('   https://supabase.com/dashboard/project/esnciydnbkanyxhjpvlk/sql');
console.log('\n2. Copy ALL the contents from:');
console.log('   c:\\bot\\supabase\\schema.sql');
console.log('\n3. Paste into the SQL Editor and click RUN');
console.log('\n4. This will create all required tables:');
console.log('   - profiles');
console.log('   - bot_settings');
console.log('   - bot_state');
console.log('   - api_credentials');
console.log('   - pricing_rules');
console.log('   - ads');
console.log('   - activity_logs');
console.log('   - competitor_rankings');
console.log('\n=== AFTER RUNNING THE SCHEMA ===\n');

// Verify connection and check tables
console.log('🔍 Checking table status...\n');

const tables = ['bot_settings', 'bot_state', 'api_credentials', 'pricing_rules', 'ads', 'activity_logs', 'competitor_rankings'];
let missingTables = [];

for (const table of tables) {
  try {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`   ❌ ${table}: ${error.message}`);
      missingTables.push(table);
    } else {
      console.log(`   ✅ ${table}: OK`);
    }
  } catch (e: any) {
    console.log(`   ❌ ${table}: ${e.message}`);
    missingTables.push(table);
  }
}

if (missingTables.length > 0) {
  console.log('\n⚠️  Tables missing. Please run schema.sql in Supabase Dashboard.');
  process.exit(1);
} else {
  console.log('\n✅ All tables exist!');
}

console.log('\n=== Setup Complete ===');
console.log('\nNow restart the bot with:');
console.log('  python launch.py');
console.log('');