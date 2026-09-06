#!/usr/bin/env npx tsx
/**
 * Apply database schema and RLS policies to the live Supabase database.
 * Uses the service-role key to execute SQL via the Supabase REST API.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = 'https://ldgjmojwkktymnrthzho.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ2ptb2p3a2t0eW1ucnRoemhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTg1NjMzMiwiZXhwIjoyMTAxNDMyMzMyfQ.f_HXeFUfrmVUwF2BbLKGK8JtypMYmGn2MH53B9KiM60';

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function executeSQL(sql: string): Promise<{ success: boolean; error?: string }> {
  // Supabase doesn't have a direct SQL execution endpoint via REST.
  // We need to use the postgres connection string or the SQL editor API.
  // The Supabase management API requires the management key, not the service role key.
  
  // Alternative: Use pg library directly
  // But we don't have a direct postgres connection string.
  
  // The best approach is to output the SQL for the user to run in the Supabase SQL Editor.
  return { success: false, error: 'Need direct postgres connection or SQL Editor access' };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     APPLY SCHEMA & RLS TO LIVE SUPABASE DATABASE           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Read schema file
  const schemaPath = resolve(__dirname, '../database/schema/schema.sql');
  const schemaSQL = readFileSync(schemaPath, 'utf8');

  // Read RLS migration files
  const rlsPaths = [
    resolve(__dirname, '../database/migrations/phase14_client_security_rls.sql'),
    resolve(__dirname, '../database/migrations/phase15_rls_for_new_tables.sql'),
    resolve(__dirname, '../database/migrations/phase16_client_portal_rls_hardening.sql'),
    resolve(__dirname, '../database/migrations/phase16_storage_rls_policies.sql'),
  ];

  console.log('SQL files to apply:');
  console.log(`  1. ${schemaPath}`);
  for (const p of rlsPaths) {
    console.log(`  2. ${p}`);
  }

  console.log('\n⚠️  Direct SQL execution via Supabase REST API is not available.');
  console.log('   The schema and RLS policies need to be applied via:');
  console.log('');
  console.log('   Option 1: Supabase Dashboard SQL Editor');
  console.log('     1. Go to https://supabase.com/dashboard');
  console.log('     2. Select your project');
  console.log('     3. Go to SQL Editor');
  console.log('     4. Copy and paste the contents of database/schema/schema.sql');
  console.log('     5. Click "Run"');
  console.log('     6. Repeat for each migration file in order');
  console.log('');
  console.log('   Option 2: Supabase CLI (if installed)');
  console.log('     supabase db push');
  console.log('');
  console.log('   Option 3: Direct postgres connection');
  console.log('     Use the database connection string from Supabase Dashboard → Settings → Database');
  console.log('');

  // Try to verify by checking if tables exist
  console.log('Checking current database state...\n');

  const tables = ['profiles', 'workspaces', 'clients', 'projects', 'deliverables', 'documents', 'invoices'];
  
  for (const table of tables) {
    const { data, error } = await adminClient.from(table).select('id').limit(1);
    if (error && error.message?.includes('Could not find the table')) {
      console.log(`  ❌ ${table}: NOT EXISTS`);
    } else {
      console.log(`  ✅ ${table}: EXISTS`);
    }
  }

  console.log('\nTo apply the schema, run the SQL files in this order:');
  console.log('  1. database/schema/schema.sql (creates all tables + basic RLS)');
  console.log('  2. database/migrations/phase14_client_security_rls.sql (client auth functions + policies)');
  console.log('  3. database/migrations/phase15_rls_for_new_tables.sql (new tables RLS)');
  console.log('  4. database/migrations/phase16_client_portal_rls_hardening.sql (portal RLS fixes)');
  console.log('  5. database/migrations/phase16_storage_rls_policies.sql (storage policies)');
}

main().catch(console.error);
