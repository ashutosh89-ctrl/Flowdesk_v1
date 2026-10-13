import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, validateRouteParam, uuidSchema, RequestRevisionDeliverableSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { canTransitionDeliverableStatus, ActorRole } from '@/shared/rules';

/**
 * Deliverable Revision Request Route Handler (Batch 2: Approvals & Deliverables)
 *
 * Secure server-side endpoint for client revision requests:
 * - Allowed from 'submitted' or 'in_review' -> 'revision_requested'.
 * - Verifies caller is assigned client or workspace owner.
 * - Records revision comment and dispatches email notification to freelancer.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ deliverableId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'deliverable_revision',
    maxRequests: 30,
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
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required to request revisions.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Route Parameter Validation
  const rawParams = await context.params;
  const paramValidation = validateRouteParam(rawParams.deliverableId, uuidSchema, 'deliverableId');
  if (!paramValidation.success) {
    return paramValidation.response;
  }
  const deliverableId = paramValidation.data;

  // 4. Request Body Validation
  const bodyValidation = await parseJsonBody(request, RequestRevisionDeliverableSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const { revisionComment } = bodyValidation.data;

  // 5. Demo Mode Handler
  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        message: 'Revision requested successfully (demo mode).',
        deliverable: {
          id: deliverableId,
          status: 'revision_requested',
          approval_status: 'revision_requested',
          rejection_reason: revisionComment,
          updated_at: new Date().toISOString(),
        },
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

  // 6. Production DB Execution & Multi-Tenant Authorization
  try {
    const { data: deliverable, error: fetchErr } = await supabaseAdmin
      .from('deliverables')
      .select('id, workspace_id, client_id, status, title')
      .eq('id', deliverableId)
      .maybeSingle();

    if (fetchErr || !deliverable) {
      return createApiErrorResponse({
        message: 'Deliverable not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    let isAuthorized = false;
    let actorRole: ActorRole = 'client';

    // Check workspace owner
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', deliverable.workspace_id)
      .maybeSingle();

    if (workspace && (workspace.owner_id === caller.userId || (workspace as any).user_id === caller.userId)) {
      isAuthorized = true;
      actorRole = 'freelancer';
    }

    // Check client assignment
    let clientName = 'Client';
    if (!isAuthorized && deliverable.client_id) {
      const { data: clientRecord } = await supabaseAdmin
        .from('clients')
        .select('id, user_id, name')
        .eq('id', deliverable.client_id)
        .maybeSingle();

      if (clientRecord && clientRecord.user_id === caller.userId) {
        isAuthorized = true;
        actorRole = 'client';
        if (clientRecord.name) clientName = clientRecord.name;
      }
    }

    if (!isAuthorized) {
      logger.security('DELIVERABLE_REVISION_FORBIDDEN', {
        requestId,
        ip,
        callerId: caller.userId,
        deliverableId,
        status: 'BLOCKED',
        reason: 'User lacks client affiliation or ownership for deliverable',
      });
      return createApiErrorResponse({
        message: 'You are not authorized to request revisions on this deliverable.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    // 7. State Machine Transition Check
    const transitionCheck = canTransitionDeliverableStatus(deliverable.status, 'revision_requested', actorRole);
    if (!transitionCheck.allowed) {
      return createApiErrorResponse({
        message: transitionCheck.reason || `Cannot request revision for deliverable with status '${deliverable.status}'.`,
        code: 'INVALID_STATUS_TRANSITION',
        status: 400,
        requestId,
      });
    }

    // 8. Atomic Status Transition Update
    const nowIso = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('deliverables')
      .update({
        status: 'revision_requested',
        approval_status: 'revision_requested',
        rejection_reason: revisionComment,
        updated_at: nowIso,
      })
      .eq('id', deliverableId)
      .select()
      .single();

    if (updateError || !updated) {
      logger.error('Failed to update deliverable revision in database', updateError, { requestId, deliverableId });
      return createApiErrorResponse({
        message: 'Failed to record revision request.',
        code: 'DATABASE_UPDATE_ERROR',
        status: 500,
        requestId,
      });
    }

    // 9. Side Effects (Non-blocking)
    // A. Add Comment Thread Entry
    try {
      await supabaseAdmin.from('deliverable_comments').insert({
        deliverable_id: deliverableId,
        author: clientName,
        author_role: actorRole,
        is_internal: false,
        content: `Revision Requested: ${revisionComment}`,
      });
    } catch { /* non-critical */ }

    // B. Activity Log
    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: deliverable.workspace_id,
        client_id: deliverable.client_id,
        action: 'requested_revision',
        title: 'Deliverable Revision Requested',
        description: `Revision requested on "${deliverable.title}". Reason: ${revisionComment}`,
        resource_type: 'deliverable',
        resource_id: deliverableId,
      });
    } catch { /* non-critical */ }

    // C. Notification & Email to Workspace Owner
    if (workspace?.owner_id) {
      try {
        await supabaseAdmin.from('notifications').insert({
          workspace_id: deliverable.workspace_id,
          user_id: workspace.owner_id,
          title: 'Revision Requested',
          message: `${clientName} requested changes on "${deliverable.title}"`,
          category: 'warning',
          link: '/deliverables',
        });

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name')
          .eq('id', workspace.owner_id)
          .single();

        if (profile?.email) {
          const { EmailService } = await import('@/backend/email/email-service');
          const { getAppBaseUrl } = await import('@/shared/utils/url');
          await EmailService.sendRevisionRequested(
            profile.email,
            {
              freelancerName: profile.full_name || 'Freelancer',
              clientName,
              projectTitle: deliverable.title,
              deliverableTitle: deliverable.title,
              revisionNotes: revisionComment,
              deliverableUrl: `${getAppBaseUrl()}/deliverables`,
            },
            { workspaceId: deliverable.workspace_id, deliverableId }
          );
        }
      } catch (notifyErr) {
        logger.warn('Non-critical notification notice for revision request', {
          requestId,
          error: String(notifyErr),
        });
      }
    }

    logger.security('DELIVERABLE_REVISION_REQUESTED', {
      requestId,
      status: 'SUCCESS',
      deliverableId,
      workspaceId: deliverable.workspace_id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Revision request recorded successfully.',
        deliverable: updated,
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
  } catch (err: any) {
    logger.error('Unexpected exception during revision request', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error processing revision request.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
