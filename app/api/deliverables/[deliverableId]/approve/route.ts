import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, validateRouteParam, uuidSchema, ApproveDeliverableSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

/**
 * Deliverable Approval Route Handler (Architecture Boundary Pilot)
 * 
 * Secure server-side mediation for deliverable sign-off:
 * 1. Requires authenticated session (freelancer or authorized client).
 * 2. Rate limited (30 requests/minute).
 * 3. Validates path UUID param and request body schema.
 * 4. Enforces state machine transition (only submitted/in_review can be approved).
 * 5. Multi-tenant boundary check: caller must own workspace or be the assigned client.
 * 6. Emits immutable activity record and security audit event.
 */

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ deliverableId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'deliverable_approve',
    maxRequests: 30,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    logger.security('DELIVERABLE_APPROVE_RATE_LIMITED', {
      requestId,
      ip,
      status: 'BLOCKED',
      reason: 'Rate limit exceeded on deliverable approval',
    });
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
    logger.security('DELIVERABLE_APPROVE_UNAUTHORIZED', {
      requestId,
      ip,
      status: 'BLOCKED',
      reason: 'Missing authenticated session',
    });
    return createApiErrorResponse({
      message: 'Authentication required to approve deliverables.',
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

  // 4. Request Body Validation (optional notes)
  const bodyValidation = await parseJsonBody(request, ApproveDeliverableSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const { notes } = bodyValidation.data;

  // 5. Demo Mode Handler
  if (isDemoModeActive()) {
    logger.info(`[Demo Mode] Approved deliverable ${deliverableId}`, {
      requestId,
      callerId: caller.userId,
    });
    return NextResponse.json(
      {
        success: true,
        message: 'Deliverable approved successfully (demo mode).',
        deliverable: {
          id: deliverableId,
          status: 'approved',
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
          notes: notes || undefined,
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

  // 6. Production Database Execution & Multi-Tenant Authorization
  try {
    // A. Query existing deliverable
    const { data: deliverable, error: fetchError } = await supabaseAdmin
      .from('deliverables')
      .select('id, workspace_id, client_id, status, title')
      .eq('id', deliverableId)
      .maybeSingle();

    if (fetchError || !deliverable) {
      logger.warn(`Deliverable ${deliverableId} not found during approval`, {
        requestId,
        callerId: caller.userId,
      });
      return createApiErrorResponse({
        message: 'Deliverable not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    // B. Authorization check:
    // Either freelancer owning workspace, or authenticated client assigned to this deliverable
    let isAuthorized = false;

    // Check if freelancer owns the workspace
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', deliverable.workspace_id)
      .maybeSingle();

    if (workspace && (workspace.owner_id === caller.userId || (workspace as any).user_id === caller.userId)) {
      isAuthorized = true;
    }

    // Check if client is assigned to this deliverable
    if (!isAuthorized && deliverable.client_id) {
      const { data: clientRecord } = await supabaseAdmin
        .from('clients')
        .select('id, user_id')
        .eq('id', deliverable.client_id)
        .maybeSingle();

      if (clientRecord && clientRecord.user_id === caller.userId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      logger.security('DELIVERABLE_APPROVE_FORBIDDEN', {
        requestId,
        ip,
        callerId: caller.userId,
        deliverableId,
        status: 'BLOCKED',
        reason: 'User lacks ownership or client affiliation for this deliverable',
      });
      return createApiErrorResponse({
        message: 'You are not authorized to approve this deliverable.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    // C. State machine transition check
    // Allowed from 'submitted' or 'in_review'
    if (deliverable.status === 'approved') {
      return createApiErrorResponse({
        message: 'This deliverable is already approved.',
        code: 'ALREADY_APPROVED',
        status: 400,
        requestId,
      });
    }

    if (deliverable.status !== 'submitted' && deliverable.status !== 'in_review') {
      return createApiErrorResponse({
        message: `Cannot approve deliverable: current status is '${deliverable.status}'. Only submitted deliverables can be approved.`,
        code: 'INVALID_STATUS_TRANSITION',
        status: 400,
        requestId,
      });
    }

    // D. Perform state transition mutation
    const nowIso = new Date().toISOString();
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('deliverables')
      .update({
        status: 'approved',
        approval_status: 'approved',
        approved_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', deliverableId)
      .select()
      .single();

    if (updateError || !updated) {
      logger.error('Failed to update deliverable approval status in database', updateError, {
        requestId,
        deliverableId,
      });
      return createApiErrorResponse({
        message: 'Failed to record deliverable approval.',
        code: 'DATABASE_UPDATE_ERROR',
        status: 500,
        internalError: updateError,
        requestId,
      });
    }

    // E. Durable Activity Log
    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: deliverable.workspace_id,
        client_id: deliverable.client_id,
        action: 'deliverable_approved',
        title: 'Deliverable Approved',
        description: `Deliverable "${deliverable.title || deliverableId}" was approved.${notes ? ` Notes: ${notes}` : ''}`,
        resource_type: 'deliverable',
        resource_id: deliverableId,
      });
    } catch (activityErr) {
      logger.warn('Non-critical activity log failed for deliverable approval', {
        requestId,
        error: String(activityErr),
      });
    }

    // F. Security Audit Trail Log
    logger.security('DELIVERABLE_APPROVED', {
      requestId,
      status: 'SUCCESS',
      deliverableId,
      workspaceId: deliverable.workspace_id,
      clientId: deliverable.client_id,
      userId: caller.userId,
      ip,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Deliverable successfully approved and signed off.',
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
    logger.error('Unexpected error during deliverable approval execution', err, {
      requestId,
      deliverableId,
    });
    return createApiErrorResponse({
      message: 'An unexpected error occurred while processing deliverable approval.',
      code: 'INTERNAL_ERROR',
      status: 500,
      internalError: err,
      requestId,
    });
  }
}
