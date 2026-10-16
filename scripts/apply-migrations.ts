#!/usr/bin/env npx tsx
/**
 * FlowDesk Migration Runner & Verifier
 * 
 * Inspects, applies (if DATABASE_URL/POSTGRES_URL is provided), and verifies
 * all version-controlled migrations in supabase/migrations/ against the Supabase database.
 * 
 * Usage: npx tsx scripts/apply-migrations.ts
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Load environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[apply-migrations] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         FLOWDESK MASTER DATABASE MIGRATION ENGINE            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`Target Supabase URL: ${SUPABASE_URL}`);
  console.log(`Timestamp:           ${new Date().toISOString()}\n`);

  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Discovered ${migrationFiles.length} version-controlled migration files in supabase/migrations/:`);
  migrationFiles.forEach((file, idx) => {
    const filePath = path.join(migrationsDir, file);
    const stats = fs.statSync(filePath);
    console.log(`  ${idx + 1}. ${file} (${stats.size} bytes)`);
  });

  // If direct postgres connection string is provided, execute migrations sequentially
  if (DATABASE_URL) {
    console.log('\nDirect PostgreSQL connection detected. Applying migrations...');
    try {
      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await pgClient.connect();
      console.log('Connected to PostgreSQL successfully.');

      for (const file of migrationFiles) {
        console.log(`Applying: ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await pgClient.query(sql);
        console.log(`  -> Applied ${file} successfully.`);
      }

      await pgClient.end();
      console.log('All migrations applied successfully via PostgreSQL connection.');
    } catch (err: any) {
      console.error('Error applying migrations via pg client:', err?.message || err);
    }
  } else {
    console.log('\n--------------------------------------------------------------');
    console.log('HOW TO APPLY MIGRATIONS TO REMOTE SUPABASE:');
    console.log('Option A: Copy & Paste Single Unified Script in Supabase SQL Editor:');
    console.log('  1. Open your Supabase Project: https://supabase.com/dashboard');
    console.log('  2. Go to SQL Editor -> New Query');
    console.log('  3. Open and copy the contents of: supabase/schema.sql');
    console.log('  4. Paste into the SQL Editor and click "Run"');
    console.log('\nOption B: If you have DATABASE_URL (Settings -> Database -> Connection string URI):');
    console.log('  Set DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres in .env.local');
    console.log('  and run: npx tsx scripts/apply-migrations.ts');
    console.log('--------------------------------------------------------------\n');
  }

  // Verification
  console.log('Verifying Database State via Supabase Data API...');
  const tables = [
    'profiles',
    'user_settings',
    'workspaces',
    'clients',
    'client_invitations',
    'projects',
    'project_milestones',
    'deliverables',
    'deliverable_versions',
    'deliverable_files',
    'deliverable_comments',
    'documents',
    'recurring_invoice_schedules',
    'invoices',
    'invoice_items',
    'invoice_payments',
    'workspace_comments',
    'activities',
    'notifications',
    'subscriptions',
    'billing_events',
    'entitlement_overrides',
    'usage_counters',
    'jobs',
    'job_runs',
    'reminder_settings',
    'reminder_log',
    'account_deletions',
    'email_events',
    'razorpay_orders',
  ];

  let existingCount = 0;
  let missingCount = 0;

  for (const table of tables) {
    const { error } = await adminClient.from(table).select('id').limit(1);
    if (error && error.message?.includes('Could not find the table')) {
      console.log(`  ❌ ${table.padEnd(30)} MISSING (not migrated yet)`);
      missingCount++;
    } else if (error) {
      console.log(`  ⚠️  ${table.padEnd(30)} Notice: ${error.message}`);
    } else {
      console.log(`  ✅ ${table.padEnd(30)} ACTIVE`);
      existingCount++;
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`STATUS: ${existingCount}/${tables.length} tables active in remote database.`);
  if (missingCount > 0) {
    console.log(`ACTION REQUIRED: Run supabase/schema.sql in the Supabase SQL Editor.`);
  } else {
    console.log(`SUCCESS: All tables are active and verified!`);
  }
  console.log('══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
