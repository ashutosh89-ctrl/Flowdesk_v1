import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, AccountDeletionRestoreSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

/**
 * Account Deletion Restoration Route Handler (Batch 4: Account & Settings)
 *
 * Secure server-side restoration of accounts within their active grace periods:
 * - Freelancer self-restoration (within 5 days).
 * - Freelancer client restoration (within 30 days).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'account_restore_req',
    maxRequests: 5,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many requests. Please try again shortly.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Authentication
  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return createApiErrorResponse({
      message: 'Authentication required to restore accounts.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Request Body Validation
  const bodyValidation = await parseJsonBody(request, AccountDeletionRestoreSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const { target, clientId } = bodyValidation.data;

  // 4. Demo Mode Handler
  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        message: `${target === 'client' ? 'Client' : 'Freelancer'} account restored successfully (demo mode).`,
        requestId,
      },
      {
        status: 200,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  // 5. Production DB Execution & Authorization
  try {
    if (target === 'client') {
      if (!clientId) {
        return createApiErrorResponse({
          message: 'Client ID is required for client account restoration.',
          code: 'BAD_REQUEST',
          status: 400,
          requestId,
        });
      }

      // Check client record and workspace ownership
      const { data: clientData, error: clientErr } = await supabaseAdmin
        .from('clients')
        .select('id, workspace_id, name, company')
        .eq('id', clientId)
        .maybeSingle();

      if (clientErr || !clientData) {
        return createApiErrorResponse({
          message: 'Client not found.',
          code: 'NOT_FOUND',
          status: 404,
          requestId,
        });
      }

      const { data: wsData } = await supabaseAdmin
        .from('workspaces')
        .select('id, owner_id')
        .eq('id', clientData.workspace_id)
        .maybeSingle();

      if (!wsData || (wsData.owner_id !== caller.userId && (wsData as any).user_id !== caller.userId)) {
        logger.security('CLIENT_RESTORATION_FORBIDDEN', {
          status: 'BLOCKED',
          requestId,
          callerUserId: caller.userId,
          clientId,
          reason: 'User lacks workspace ownership for restoring this client',
        });
        return createApiErrorResponse({
          message: 'Only the workspace owner can restore this client account.',
          code: 'FORBIDDEN',
          status: 403,
          requestId,
        });
      }

      // Check deletion record window
      const { data: deletionRecord } = await supabaseAdmin
        .from('account_deletions')
        .select('id, restore_until, status')
        .eq('client_id', clientId)
        .eq('status', 'pending_deletion')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (deletionRecord) {
        const deadline = new Date(deletionRecord.restore_until);
        if (deadline.getTime() < Date.now()) {
          return createApiErrorResponse({
            message: 'The 30-day recovery period has expired. This account cannot be restored.',
            code: 'RECOVERY_WINDOW_EXPIRED',
            status: 400,
            requestId,
          });
        }

        await supabaseAdmin
          .from('account_deletions')
          .update({
            status: 'restored',
            updated_at: new Date().toISOString(),
          })
          .eq('id', deletionRecord.id);
      }

      // Restore client status
      const { data: restored, error: restoreErr } = await supabaseAdmin
        .from('clients')
        .update({
          status: 'active',
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId)
        .select()
        .single();

      if (restoreErr || !restored) {
        logger.error('Failed to update client status for restoration', restoreErr, { requestId });
        return createApiErrorResponse({
          message: 'Failed to restore client.',
          code: 'DATABASE_UPDATE_ERROR',
          status: 500,
          requestId,
        });
      }

      // Activity log
      try {
        await supabaseAdmin.from('activities').insert({
          workspace_id: clientData.workspace_id,
          client_id: clientId,
          action: 'client_account_restored',
          title: 'Client Account Restored',
          description: `Freelancer restored access for ${clientData.name} (${clientData.company}).`,
          user_name: 'Freelancer',
          resource_type: 'client',
        });
      } catch { /* non-critical */ }

      logger.security('CLIENT_RESTORED', {
        requestId,
        status: 'SUCCESS',
        clientId,
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Client account restored successfully.',
          client: restored,
          requestId,
        },
        {
          status: 200,
          headers: {
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    } else {
      // Freelancer self-restoration
      const { data: record } = await supabaseAdmin
        .from('account_deletions')
        .select('id, restore_until, workspace_id')
        .eq('user_id', caller.userId)
        .eq('account_type', 'freelancer')
        .eq('status', 'pending_deletion')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (record) {
        const deadline = new Date(record.restore_until);
        if (deadline.getTime() < Date.now()) {
          return createApiErrorResponse({
            message: 'The 5-day recovery window has expired. This account cannot be restored.',
            code: 'RECOVERY_WINDOW_EXPIRED',
            status: 400,
            requestId,
          });
        }

        await supabaseAdmin
          .from('account_deletions')
          .update({
            status: 'restored',
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);
      }

      // Restore workspace & profile
      if (record?.workspace_id) {
        await supabaseAdmin
          .from('workspaces')
          .update({
            status: 'active',
            deleted_at: null,
          })
          .eq('id', record.workspace_id);
      }

      await supabaseAdmin
        .from('profiles')
        .update({
          status: 'active',
          deleted_at: null,
        })
        .eq('id', caller.userId);

      logger.security('FREELANCER_RESTORED', {
        requestId,
        status: 'SUCCESS',
        userId: caller.userId,
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Freelancer account restored successfully.',
          requestId,
        },
        {
          status: 200,
          headers: {
            'X-Request-Id': requestId,
            'Cache-Control': 'no-store',
          },
        }
      );
    }
  } catch (err: any) {
    logger.error('Unexpected exception during account restoration', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error restoring account.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
