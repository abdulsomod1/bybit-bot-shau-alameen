
/**
 * Supabase Connection and Table Status Test
 *
 * Run from your project directory:
 *   node test-connection.js
 *
 * This script checks the Supabase connection, verifies that the
 * required tables are accessible, and reports configuration errors.
 *
 * IMPORTANT:
 * - Keep the service-role key on the server or in a local test script.
 * - Never expose it in frontend code or commit it to GitHub.
 * - This test does not insert, update, or delete database records.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const TABLES = [
  'bot_settings',
  'bot_state',
  'api_credentials',
  'pricing_rules',
  'ads',
  'activity_logs',
  'competitor_rankings',
];

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function maskUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '(invalid URL)';
  }
}

async function main() {
  console.log('\n=== Supabase Connection Test ===\n');

  // 1. Validate environment variables.
  if (!SUPABASE_URL) {
    fail('SUPABASE_URL is missing from your environment.');
  }

  if (!/^https:\/\/[^/]+/i.test(SUPABASE_URL)) {
    fail(
      'SUPABASE_URL must be a valid HTTPS Supabase project URL.'
    );
  }

  if (!SERVICE_ROLE_KEY) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY is missing. ' +
      'Configure it in your local .env file or Render environment.'
    );
  }

  if (
    SERVICE_ROLE_KEY === '<PASTE-SERVICE-ROLE-KEY-HERE>' ||
    SERVICE_ROLE_KEY.toLowerCase().includes('placeholder')
  ) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY still contains a placeholder. ' +
      'Replace it with your actual server-side secret key.'
    );
  }

  console.log(`Project: ${maskUrl(SUPABASE_URL)}`);
  console.log('Environment variables: present');
  console.log('Creating server-side Supabase client...\n');

  // 2. Create the Supabase client.
  const supabase = createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  // 3. Check each table without printing stored records.
  let passed = 0;
  let failed = 0;

  console.log('Checking required tables...\n');

  for (const table of TABLES) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(0);

      if (error) {
        failed++;
        console.error(`❌ ${table}: ${error.message}`);

        if (error.code === '42P01' || error.code === 'PGRST205') {
          console.error(
            '   Hint: The table may be missing or its schema ' +
            'may not be exposed through the API.'
          );
        } else if (error.code === '42501') {
          console.error(
            '   Hint: Database permissions may be insufficient.'
          );
        }
      } else {
        passed++;
        console.log(`✅ ${table}: accessible`);
      }
    } catch (error) {
      failed++;
      console.error(
        `❌ ${table}: ${error?.message ?? 'Unexpected error'}`
      );
    }
  }

  // 4. Summarize results.
  console.log('\n=== Test Summary ===');
  console.log(`Accessible tables: ${passed}/${TABLES.length}`);
  console.log(`Failed checks: ${failed}/${TABLES.length}`);

  if (failed > 0) {
    console.log('\nSome checks failed.');
    console.log(
      'Review the errors above and verify your table schema, ' +
      'environment variables, and database permissions.'
    );
    process.exitCode = 1;
    return;
  }

  console.log('\n✅ All required tables are accessible.');
  console.log(
    '\nNote: This test does not verify credential insertion, ' +
    'encryption, or the bot backend’s actual Supabase client.'
  );
  console.log(
    'Next: inspect the saveCredentials implementation ' +
    'if credential saving still fails.'
  );
}

main().catch((error) => {
  console.error(
    '\n❌ Supabase test failed:',
    error?.message ?? error
  );
  process.exitCode = 1;
});
