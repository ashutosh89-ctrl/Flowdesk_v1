import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, validateRouteParam, uuidSchema, SubmitDeliverableSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { canTransitionDeliverableStatus } from '@/shared/rules';

/**
 * Deliverable Submission Route Handler (Batch 2: Approvals & Deliverables)
 *
 * Secure server-side transition for deliverable submission:
 * - Allowed from 'draft' or 'revision_requested' -> 'submitted'.
 * - Restricted to authenticated workspace owner (freelancer).
 * - Dispatches transactional email to client (non-blocking).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ deliverableId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'deliverable_submit',
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
      message: 'Authentication required to submit deliverable.',
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
  const bodyValidation = await parseJsonBody(request, SubmitDeliverableSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const { submissionMessage, reviewDeadline } = bodyValidation.data;

  // 5. Demo Mode Handler
  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        message: 'Deliverable submitted for review (demo mode).',
        deliverable: {
          id: deliverableId,
          status: 'submitted',
          approval_status: 'pending',
          submission_message: submissionMessage,
          review_deadline: reviewDeadline,
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

  // 6. Production DB Execution & Authorization
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

    // Verify workspace ownership
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', deliverable.workspace_id)
      .maybeSingle();

    if (!workspace || (workspace.owner_id !== caller.userId && (workspace as any).user_id !== caller.userId)) {
      return createApiErrorResponse({
        message: 'Only the workspace owner can submit deliverables for review.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    // 7. State Machine Transition Check
    const transitionCheck = canTransitionDeliverableStatus(deliverable.status, 'submitted', 'freelancer');
    if (!transitionCheck.allowed) {
      return createApiErrorResponse({
        message: transitionCheck.reason || `Cannot submit deliverable with status '${deliverable.status}'.`,
        code: 'INVALID_STATUS_TRANSITION',
        status: 400,
        requestId,
      });
    }

    // 8. Atomic Database Update
    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      status: 'submitted',
      approval_status: 'pending',
      submission_message: submissionMessage || null,
      updated_at: nowIso,
    };
    if (reviewDeadline) {
      updatePayload.review_deadline = reviewDeadline;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('deliverables')
      .update(updatePayload)
      .eq('id', deliverableId)
      .select()
      .single();

    if (updateError || !updated) {
      logger.error('Failed to update deliverable submission in database', updateError, { requestId, deliverableId });
      return createApiErrorResponse({
        message: 'Failed to record deliverable submission.',
        code: 'DATABASE_UPDATE_ERROR',
        status: 500,
        requestId,
      });
    }

    // 9. Side Effects (Non-blocking)
    // A. Activity Log
    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: deliverable.workspace_id,
        client_id: deliverable.client_id,
        action: 'submitted_deliverable',
        title: 'Deliverable Submitted for Review',
        description: `Deliverable "${deliverable.title}" was submitted for client sign-off.`,
        resource_type: 'deliverable',
        resource_id: deliverableId,
      });
    } catch { /* non-critical */ }

    // B. Email Dispatch to Client
    if (deliverable.client_id) {
      try {
        const { data: client } = await supabaseAdmin
          .from('clients')
          .select('name, email')
          .eq('id', deliverable.client_id)
          .maybeSingle();

        if (client?.email) {
          const { EmailService } = await import('@/backend/email/email-service');
          const { getAppBaseUrl } = await import('@/shared/utils/url');
          await EmailService.sendDeliverableReady(
            client.email,
            {
              clientName: client.name || 'Client',
              projectTitle: deliverable.title,
              deliverableTitle: deliverable.title,
              portalUrl: `${getAppBaseUrl()}/portal/${deliverable.client_id}`,
            },
            { workspaceId: deliverable.workspace_id, deliverableId }
          );
        }
      } catch (emailErr) {
        logger.warn('Non-critical email dispatch notice for deliverable submission', {
          requestId,
          error: String(emailErr),
        });
      }
    }

    logger.security('DELIVERABLE_SUBMITTED', {
      requestId,
      status: 'SUCCESS',
      deliverableId,
      workspaceId: deliverable.workspace_id,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Deliverable submitted for client review.',
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
    logger.error('Unexpected exception during deliverable submission', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error submitting deliverable.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
