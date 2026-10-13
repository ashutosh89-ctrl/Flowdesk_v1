import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { StorageHelper, StorageBucket } from '@/backend/storage/storage-helper';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';

/**
 * Account Deletion Purge Cron Route
 * 
 * Invoked by automated scheduler (e.g. Vercel Cron, external trigger) to permanently
 * hard-purge accounts whose recovery retention window has expired.
 * 
 * Security controls:
 * - Authentication: Bearer token matched against process.env.CRON_SECRET via timingSafeEqual
 * - Rate limited: 20 requests/min per IP
 * - Dry-run default: Requires explicit `?dry_run=false` parameter to mutate data
 * - Financial ledger protection: Preserves paid invoices and transaction audit logs
 * - Structured audit logging for forensic traceability
 */

function verifyCronSecret(authHeader: string | null, expectedSecret?: string): boolean {
  if (!expectedSecret || typeof expectedSecret !== 'string' || expectedSecret.trim().length === 0) {
    return false;
  }
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7).trim();
  if (!token) return false;

  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (tokenBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
}

interface PurgeResult {
  recordId: string;
  accountType: 'client' | 'freelancer';
  targetId: string;
  filesDeleted: number;
  status: 'purged' | 'dry_run' | 'failed';
  error?: string;
}

async function executeAccountPurge(
  request: NextRequest
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'cron_purge',
    maxRequests: 20,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    logger.security('CRON_PURGE_RATE_LIMITED', {
      requestId,
      ip,
      status: 'BLOCKED',
      reason: 'Rate limit exceeded for cron purge endpoint',
    });
    return createApiErrorResponse({
      message: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Authentication: Bearer CRON_SECRET verification
  const expectedCronSecret = process.env.CRON_SECRET;
  if (!expectedCronSecret) {
    logger.security('CRON_PURGE_UNCONFIGURED', {
      requestId,
      ip,
      status: 'BLOCKED',
      reason: 'CRON_SECRET environment variable is not configured',
    });
    return createApiErrorResponse({
      message: 'Cron service is not configured on this server.',
      code: 'CRON_UNCONFIGURED',
      status: 500,
      requestId,
    });
  }

  const authHeader = request.headers.get('authorization');
  if (!verifyCronSecret(authHeader, expectedCronSecret)) {
    logger.security('CRON_PURGE_UNAUTHORIZED', {
      requestId,
      ip,
      status: 'BLOCKED',
      reason: 'Invalid or missing Authorization Bearer token',
    });
    return createApiErrorResponse({
      message: 'Unauthorized cron invocation.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Query parameters parsing (defaults to dry-run = true for safety)
  const url = new URL(request.url);
  const dryRunParam = url.searchParams.get('dry_run');
  const isDryRun = dryRunParam !== 'false';

  const limitParam = Number(url.searchParams.get('limit')) || 50;
  const limit = Math.min(100, Math.max(1, limitParam));

  logger.info(`Starting account purge sweep (dryRun=${isDryRun}, limit=${limit})`, {
    requestId,
    ip,
    action: 'cron_purge_start',
  });

  // 4. In demo mode, return simulated result
  if (isDemoModeActive()) {
    return NextResponse.json({
      success: true,
      dryRun: isDryRun,
      message: 'Demo mode active: simulated purge run completed.',
      eligibleAccounts: 0,
      processedAccounts: 0,
      storageFilesDeleted: 0,
      details: [],
      errors: [],
      timestamp: new Date().toISOString(),
      requestId,
    }, {
      headers: {
        'X-Request-Id': requestId,
        'Cache-Control': 'no-store',
      },
    });
  }

  // 5. Query expired accounts from account_deletions table
  const nowIso = new Date().toISOString();
  const { data: expiredRecords, error: fetchError } = await supabaseAdmin
    .from('account_deletions')
    .select('id, account_type, user_id, workspace_id, client_id, deleted_at, restore_until, status, metadata')
    .eq('status', 'pending_deletion')
    .lte('restore_until', nowIso)
    .order('restore_until', { ascending: true })
    .limit(limit);

  if (fetchError) {
    logger.error('Failed to query expired account deletions from database', fetchError, {
      requestId,
    });
    return createApiErrorResponse({
      message: 'Failed to query account deletion records.',
      code: 'DATABASE_QUERY_ERROR',
      status: 500,
      internalError: fetchError,
      requestId,
    });
  }

  const records = expiredRecords || [];
  const results: PurgeResult[] = [];
  const errors: string[] = [];
  let totalFilesDeleted = 0;

  for (const record of records) {
    const targetId = record.account_type === 'client' ? record.client_id : record.user_id;
    if (!targetId) continue;

    if (isDryRun) {
      results.push({
        recordId: record.id,
        accountType: record.account_type,
        targetId,
        filesDeleted: 0,
        status: 'dry_run',
      });
      continue;
    }

    // 6. Hard purge execution (dry_run = false)
    try {
      let filesDeletedForAccount = 0;

      if (record.account_type === 'client') {
        const clientId = record.client_id;
        if (!clientId) continue;

        // A. Storage cleanup: documents and deliverables
        try {
          const { data: docs } = await supabaseAdmin
            .from('documents')
            .select('file_url')
            .eq('client_id', clientId);

          if (docs && docs.length > 0) {
            for (const doc of docs) {
              if (doc.file_url) {
                const res = await StorageHelper.deleteFile('documents', doc.file_url);
                if (res.success) filesDeletedForAccount++;
              }
            }
          }

          const { data: deliverables } = await supabaseAdmin
            .from('deliverables')
            .select('file_url')
            .eq('client_id', clientId);

          if (deliverables && deliverables.length > 0) {
            for (const del of deliverables) {
              if (del.file_url) {
                const res = await StorageHelper.deleteFile('deliverables', del.file_url);
                if (res.success) filesDeletedForAccount++;
              }
            }
          }
        } catch (storageErr: any) {
          logger.warn(`Storage cleanup notice for client ${clientId}: ${storageErr.message}`, {
            requestId,
          });
        }

        // B. Preserve financial ledger: anonymize paid invoices
        const { data: paidInvoices } = await supabaseAdmin
          .from('invoices')
          .select('id, paid_amount')
          .eq('client_id', clientId);

        const paidIds = (paidInvoices || [])
          .filter((inv) => Number(inv.paid_amount) > 0)
          .map((inv) => inv.id);

        if (paidIds.length > 0) {
          await supabaseAdmin
            .from('invoices')
            .update({
              client_id: null,
              client_name: 'Archived Client',
              client_email: 'deleted@archived.local',
            })
            .in('id', paidIds);
        }

        // C. Delete client-associated transient rows
        await Promise.allSettled([
          supabaseAdmin.from('deliverables').delete().eq('client_id', clientId),
          supabaseAdmin.from('documents').delete().eq('client_id', clientId),
          supabaseAdmin.from('invoices').delete().eq('client_id', clientId), // Deletes unpaid invoices
          supabaseAdmin.from('workspace_comments').delete().eq('client_id', clientId),
          supabaseAdmin.from('notifications').delete().eq('client_id', clientId),
          supabaseAdmin.from('activities').delete().eq('client_id', clientId),
          supabaseAdmin.from('projects').delete().eq('client_id', clientId),
        ]);

        // D. Delete client row
        const { error: deleteClientError } = await supabaseAdmin
          .from('clients')
          .delete()
          .eq('id', clientId);

        if (deleteClientError) {
          throw new Error(`Failed to delete client row: ${deleteClientError.message}`);
        }

        // E. Mark deletion record permanently_deleted
        await supabaseAdmin
          .from('account_deletions')
          .update({
            status: 'permanently_deleted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);

      } else if (record.account_type === 'freelancer') {
        const userId = record.user_id;
        if (!userId) continue;

        // Find workspaces owned by freelancer
        const { data: workspaces } = await supabaseAdmin
          .from('workspaces')
          .select('id')
          .or(`owner_id.eq.${userId},user_id.eq.${userId}`);

        const workspaceIds = (workspaces || []).map((w) => w.id);

        for (const wsId of workspaceIds) {
          // Storage cleanup for workspace
          try {
            const buckets: StorageBucket[] = ['documents', 'deliverables', 'avatars', 'logos', 'signatures'];
            for (const b of buckets) {
              const { data: files } = await supabaseAdmin.storage.from(b).list(`workspaces/${wsId}`);
              if (files && files.length > 0) {
                const filePaths = files.map((f) => `workspaces/${wsId}/${f.name}`);
                await supabaseAdmin.storage.from(b).remove(filePaths);
                filesDeletedForAccount += filePaths.length;
              }
            }
          } catch {
            // Storage best-effort cleanup
          }

          // Delete workspace
          await supabaseAdmin.from('workspaces').delete().eq('id', wsId);
        }

        // Delete profile
        await supabaseAdmin.from('profiles').delete().eq('id', userId);

        // Mark permanently_deleted
        await supabaseAdmin
          .from('account_deletions')
          .update({
            status: 'permanently_deleted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);
      }

      totalFilesDeleted += filesDeletedForAccount;
      results.push({
        recordId: record.id,
        accountType: record.account_type,
        targetId,
        filesDeleted: filesDeletedForAccount,
        status: 'purged',
      });

      logger.security('ACCOUNT_PURGED_PERMANENTLY', {
        requestId,
        status: 'SUCCESS',
        action: 'cron_account_purge',
        recordId: record.id,
        accountType: record.account_type,
        targetId,
        filesDeleted: filesDeletedForAccount,
      });

    } catch (purgeError: any) {
      const errMsg = purgeError?.message || 'Unknown error during purge';
      errors.push(`Record ${record.id}: ${errMsg}`);
      results.push({
        recordId: record.id,
        accountType: record.account_type,
        targetId,
        filesDeleted: 0,
        status: 'failed',
        error: errMsg,
      });

      logger.error(`Error purging account ${record.id}`, purgeError, {
        requestId,
        recordId: record.id,
      });
    }
  }

  return NextResponse.json({
    success: true,
    dryRun: isDryRun,
    eligibleAccounts: records.length,
    processedAccounts: results.filter((r) => r.status === 'purged').length,
    storageFilesDeleted: totalFilesDeleted,
    details: results,
    errors,
    timestamp: new Date().toISOString(),
    requestId,
  }, {
    headers: {
      'X-Request-Id': requestId,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return executeAccountPurge(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return executeAccountPurge(request);
}
