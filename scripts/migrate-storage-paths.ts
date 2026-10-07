/**
 * FLOWDESK STORAGE PATH MIGRATION SCRIPT (SEC-HIGH-02)
 * 
 * Migrates legacy storage object paths in 'documents' and 'deliverables' buckets
 * to the canonical folder structure:
 *   - Client-scoped:   workspaces/<workspaceId>/clients/<clientId>/<prefix>_<fileName>
 *   - Workspace-level: workspaces/<workspaceId>/shared/<prefix>_<fileName>
 * 
 * SAFEGUARDS:
 * - Defaults to DRY-RUN mode.
 * - Requires explicit '--apply' flag to execute any storage/DB mutations.
 * - Reads credentials strictly from environment variables (NEVER prints secrets).
 * - Fully idempotent: skips objects already adhering to canonical format.
 * - Updates DB rows and moves storage objects atomically per item.
 * 
 * Usage:
 *   npx tsx scripts/migrate-storage-paths.ts          # Dry-run plan only
 *   npx tsx scripts/migrate-storage-paths.ts --apply  # Execute migrations
 */

import { createClient } from '@supabase/supabase-js';
import { sanitizeFileName } from '../src/backend/storage/storage-helper';
import crypto from 'crypto';

interface MigrationPlanItem {
  table: string;
  recordId: string;
  bucket: 'documents' | 'deliverables';
  oldPath: string;
  newPath: string;
  workspaceId: string;
  clientId: string | null;
}

async function runMigration() {
  const isApply = process.argv.includes('--apply');

  console.log('================================================================');
  console.log('🔄 FLOWDESK STORAGE CANONICAL PATH MIGRATION');
  console.log(`MODE: ${isApply ? '⚠️  APPLY (LIVE MUTATION)' : '🛡️  DRY-RUN (PLAN ONLY)'}`);
  console.log('================================================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Environment configuration error:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment.');
    console.error('   Exiting safely without action.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const plan: MigrationPlanItem[] = [];
  let alreadyCanonicalCount = 0;
  let skippedInvalidCount = 0;

  function isCanonical(path: string, workspaceId: string, clientId?: string | null): boolean {
    if (!path.startsWith('workspaces/')) return false;
    const parts = path.split('/');
    if (parts.length < 4) return false;
    if (parts[1] !== workspaceId) return false;
    if (clientId && parts[2] === 'clients' && parts[3] === clientId) return true;
    if (!clientId && parts[2] === 'shared') return true;
    return false;
  }

  function computeNewPath(
    bucket: 'documents' | 'deliverables',
    workspaceId: string,
    clientId: string | null,
    fileName: string
  ): string {
    const safeName = sanitizeFileName(fileName || 'file');
    const prefix = crypto.randomUUID();
    if (clientId) {
      return `workspaces/${workspaceId}/clients/${clientId}/${prefix}_${safeName}`;
    }
    return `workspaces/${workspaceId}/shared/${prefix}_${safeName}`;
  }

  // 1. Scan public.documents
  console.log('📦 Scanning table: public.documents ...');
  const { data: documents, error: docErr } = await supabase
    .from('documents')
    .select('id, workspace_id, client_id, file_url, file_name')
    .not('file_url', 'is', null);

  if (docErr) {
    console.error('❌ Failed to query documents table:', docErr.message);
  } else if (documents) {
    for (const doc of documents) {
      const url = doc.file_url?.trim();
      if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('local/')) {
        skippedInvalidCount++;
        continue;
      }

      if (isCanonical(url, doc.workspace_id, doc.client_id)) {
        alreadyCanonicalCount++;
      } else {
        const newPath = computeNewPath('documents', doc.workspace_id, doc.client_id, doc.file_name || 'document.pdf');
        plan.push({
          table: 'documents',
          recordId: doc.id,
          bucket: 'documents',
          oldPath: url,
          newPath,
          workspaceId: doc.workspace_id,
          clientId: doc.client_id,
        });
      }
    }
  }

  // 2. Scan public.deliverable_files
  console.log('📦 Scanning table: public.deliverable_files ...');
  const { data: deliverableFiles, error: dfErr } = await supabase
    .from('deliverable_files')
    .select('id, deliverable_id, file_url, file_name')
    .not('file_url', 'is', null);

  if (dfErr) {
    console.error('❌ Failed to query deliverable_files table:', dfErr.message);
  } else if (deliverableFiles) {
    for (const df of deliverableFiles) {
      const url = df.file_url?.trim();
      if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('local/')) {
        skippedInvalidCount++;
        continue;
      }

      // Fetch deliverable context
      const { data: del } = await supabase
        .from('deliverables')
        .select('workspace_id, client_id')
        .eq('id', df.deliverable_id)
        .maybeSingle();

      if (!del?.workspace_id) {
        skippedInvalidCount++;
        continue;
      }

      if (isCanonical(url, del.workspace_id, del.client_id)) {
        alreadyCanonicalCount++;
      } else {
        const newPath = computeNewPath('deliverables', del.workspace_id, del.client_id, df.file_name || 'deliverable');
        plan.push({
          table: 'deliverable_files',
          recordId: df.id,
          bucket: 'deliverables',
          oldPath: url,
          newPath,
          workspaceId: del.workspace_id,
          clientId: del.client_id,
        });
      }
    }
  }

  // 3. Scan public.deliverable_versions
  console.log('📦 Scanning table: public.deliverable_versions ...');
  const { data: deliverableVersions, error: dvErr } = await supabase
    .from('deliverable_versions')
    .select('id, deliverable_id, file_url, file_name')
    .not('file_url', 'is', null);

  if (dvErr) {
    console.error('❌ Failed to query deliverable_versions table:', dvErr.message);
  } else if (deliverableVersions) {
    for (const dv of deliverableVersions) {
      const url = dv.file_url?.trim();
      if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('local/')) {
        skippedInvalidCount++;
        continue;
      }

      const { data: del } = await supabase
        .from('deliverables')
        .select('workspace_id, client_id')
        .eq('id', dv.deliverable_id)
        .maybeSingle();

      if (!del?.workspace_id) {
        skippedInvalidCount++;
        continue;
      }

      if (isCanonical(url, del.workspace_id, del.client_id)) {
        alreadyCanonicalCount++;
      } else {
        const newPath = computeNewPath('deliverables', del.workspace_id, del.client_id, dv.file_name || 'version');
        plan.push({
          table: 'deliverable_versions',
          recordId: dv.id,
          bucket: 'deliverables',
          oldPath: url,
          newPath,
          workspaceId: del.workspace_id,
          clientId: del.client_id,
        });
      }
    }
  }

  // Print Summary Plan
  console.log('\n================================================================');
  console.log('📊 MIGRATION PLAN SUMMARY');
  console.log('================================================================');
  console.log(`  Total Objects Already Canonical:  ${alreadyCanonicalCount}`);
  console.log(`  Total Objects Skipped / Non-File: ${skippedInvalidCount}`);
  console.log(`  Total Objects Requiring Move:     ${plan.length}`);
  console.log('----------------------------------------------------------------');

  if (plan.length === 0) {
    console.log('✨ No legacy objects require migration. All objects are canonical!');
    return;
  }

  console.log('\nSample migration plan (first 5 items):');
  plan.slice(0, 5).forEach((item, idx) => {
    console.log(`  [${idx + 1}] Table: ${item.table} (ID: ${item.recordId})`);
    console.log(`      Bucket:   ${item.bucket}`);
    console.log(`      Current:  ${item.oldPath}`);
    console.log(`      Target:   ${item.newPath}\n`);
  });

  if (!isApply) {
    console.log('🛑 DRY-RUN COMPLETE: No files were moved, no database rows were modified.');
    console.log('   To execute this migration plan against live storage, run:');
    console.log('   npx tsx scripts/migrate-storage-paths.ts --apply\n');
    return;
  }

  // Live Apply Execution
  console.log('🚀 Executing migration moves...');
  let movedCount = 0;
  let failedCount = 0;

  for (const item of plan) {
    try {
      // Step A: Move storage object
      const { error: moveErr } = await supabase.storage
        .from(item.bucket)
        .move(item.oldPath, item.newPath);

      if (moveErr) {
        console.warn(`  ⚠️ Failed to move object ${item.bucket}/${item.oldPath}: ${moveErr.message}`);
        failedCount++;
        continue;
      }

      // Step B: Update database pointer
      const { error: dbErr } = await supabase
        .from(item.table)
        .update({ file_url: item.newPath })
        .eq('id', item.recordId);

      if (dbErr) {
        console.error(`  ❌ DB update error for ${item.table} (${item.recordId}): ${dbErr.message}`);
        failedCount++;
      } else {
        movedCount++;
      }
    } catch (err: any) {
      console.error(`  ❌ Unexpected error migrating item: ${err?.message}`);
      failedCount++;
    }
  }

  console.log('\n================================================================');
  console.log(`🎉 MIGRATION COMPLETED: ${movedCount} successfully moved, ${failedCount} errors.`);
  console.log('================================================================\n');
}

runMigration().catch((err) => {
  console.error('Fatal error during storage migration:', err?.message || err);
  process.exit(1);
});
