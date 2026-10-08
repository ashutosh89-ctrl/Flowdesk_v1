import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, AccountDeletionRequestSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

/**
 * Account Deletion Request Route Handler (Batch 4: Account & Settings)
 *
 * Secure server-side initiation of account deletion lifecycle:
 * - Freelancer self-deletion (5-day recovery window).
 * - Client account deletion (30-day recovery window).
 * - Strictly verifies identity derived from authenticated session.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'account_deletion_req',
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
  if (!caller || (!caller.isDemo && !caller.userId && !caller.clientId)) {
    return createApiErrorResponse({
      message: 'Authentication required to request account deletion.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Request Body Validation
  const bodyValidation = await parseJsonBody(request, AccountDeletionRequestSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const { target, clientId, reason } = bodyValidation.data;

  const now = new Date();

  // 4. Demo Mode Handler
  if (isDemoModeActive()) {
    const graceDays = target === 'client' ? 30 : 5;
    const restoreUntil = new Date(now.getTime() + graceDays * 24 * 60 * 60 * 1000).toISOString();
    return NextResponse.json(
      {
        success: true,
        message: `${target === 'client' ? 'Client' : 'Freelancer'} account deletion scheduled (demo mode).`,
        restoreUntil,
        gracePeriodDays: graceDays,
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
      const targetClientId = clientId || caller.clientId;
      if (!targetClientId) {
        return createApiErrorResponse({
          message: 'Client ID required for client account deletion.',
          code: 'BAD_REQUEST',
          status: 400,
          requestId,
        });
      }

      // Fetch client
      const { data: clientData, error: clientErr } = await supabaseAdmin
        .from('clients')
        .select('id, workspace_id, user_id, name, company')
        .eq('id', targetClientId)
        .maybeSingle();

      if (clientErr || !clientData) {
        return createApiErrorResponse({
          message: 'Client record not found.',
          code: 'NOT_FOUND',
          status: 404,
          requestId,
        });
      }

      // Authorization: Caller must either be the client self-deleting, or workspace owner
      let isAuthorized = false;
      if (caller.clientId && caller.clientId === targetClientId) {
        isAuthorized = true;
      } else if (caller.userId) {
        const { data: ws } = await supabaseAdmin
          .from('workspaces')
          .select('id, owner_id')
          .eq('id', clientData.workspace_id)
          .maybeSingle();
        if (ws && (ws.owner_id === caller.userId || (ws as any).user_id === caller.userId)) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        logger.security('CLIENT_DELETION_FORBIDDEN', {
          status: 'BLOCKED',
          requestId,
          callerUserId: caller.userId,
          callerClientId: caller.clientId,
          targetClientId,
          reason: 'Caller lacks authorization to schedule deletion for this client',
        });
        return createApiErrorResponse({
          message: 'Unauthorized to schedule deletion for this client.',
          code: 'FORBIDDEN',
          status: 403,
          requestId,
        });
      }

      const restoreUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Update client status
      const { error: clientUpdateErr } = await supabaseAdmin
        .from('clients')
        .update({
          status: 'pending_deletion',
          deleted_at: now.toISOString(),
        })
        .eq('id', targetClientId);

      if (clientUpdateErr) {
        logger.error('Failed to update client status for deletion', clientUpdateErr, { requestId });
        return createApiErrorResponse({
          message: 'Failed to schedule client deletion.',
          code: 'DATABASE_UPDATE_ERROR',
          status: 500,
          requestId,
        });
      }

      // Insert into account_deletions
      await supabaseAdmin.from('account_deletions').insert({
        account_type: 'client',
        user_id: caller.userId || clientData.user_id || null,
        workspace_id: clientData.workspace_id,
        client_id: targetClientId,
        deleted_by: caller.userId || targetClientId,
        deleted_at: now.toISOString(),
        restore_until: restoreUntil,
        status: 'pending_deletion',
        metadata: {
          client_name: clientData.name,
          client_company: clientData.company,
          reason,
        },
      });

      // Log activity
      try {
        await supabaseAdmin.from('activities').insert({
          workspace_id: clientData.workspace_id,
          client_id: targetClientId,
          action: 'client_account_deleted',
          title: 'Client Account Deletion Initiated',
          description: `${clientData.name} (${clientData.company}) scheduled account deletion. 30-day recovery window active.`,
          user_name: clientData.name,
          resource_type: 'client',
        });
      } catch { /* non-critical */ }

      logger.security('CLIENT_DELETION_SCHEDULED', {
        requestId,
        status: 'SUCCESS',
        clientId: targetClientId,
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Client account scheduled for deletion. 30-day recovery window active.',
          restoreUntil,
          gracePeriodDays: 30,
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
      // Freelancer self-deletion
      if (!caller.userId) {
        return createApiErrorResponse({
          message: 'User authentication required for freelancer account deletion.',
          code: 'UNAUTHORIZED',
          status: 401,
          requestId,
        });
      }

      const restoreUntil = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString();

      // Find user workspace
      const { data: ws } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', caller.userId)
        .maybeSingle();

      const wsId = ws?.id;

      if (wsId) {
        await supabaseAdmin.from('workspaces').update({
          status: 'pending_deletion',
          deleted_at: now.toISOString(),
        }).eq('id', wsId);
      }

      await supabaseAdmin.from('profiles').update({
        status: 'pending_deletion',
        deleted_at: now.toISOString(),
      }).eq('id', caller.userId);

      // Record in account_deletions
      await supabaseAdmin.from('account_deletions').insert({
        account_type: 'freelancer',
        user_id: caller.userId,
        workspace_id: wsId || null,
        deleted_by: caller.userId,
        deleted_at: now.toISOString(),
        restore_until: restoreUntil,
        status: 'pending_deletion',
        metadata: { reason },
      });

      // Side Effect: Trigger account deletion scheduled email (non-blocking)
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name')
          .eq('id', caller.userId)
          .maybeSingle();

        if (profile?.email) {
          const { EmailService } = await import('@/backend/email/email-service');
          const { getAppBaseUrl } = await import('@/shared/utils/url');
          await EmailService.sendAccountDeleted(profile.email, {
            name: profile.full_name || 'User',
            action: 'scheduled_deletion',
            gracePeriodDays: 5,
            restoreUntil: restoreUntil.split('T')[0],
            restoreUrl: `${getAppBaseUrl()}/recover`,
          }, { workspaceId: wsId || undefined, userId: caller.userId });
        }
      } catch (emailErr) {
        logger.warn('Non-critical email dispatch notice for freelancer account deletion', {
          requestId,
          error: String(emailErr),
        });
      }

      logger.security('FREELANCER_DELETION_SCHEDULED', {
        requestId,
        status: 'SUCCESS',
        userId: caller.userId,
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Freelancer account scheduled for deletion. 5-day recovery window active.',
          restoreUntil,
          gracePeriodDays: 5,
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
    logger.error('Unexpected exception during account deletion scheduling', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error scheduling account deletion.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
