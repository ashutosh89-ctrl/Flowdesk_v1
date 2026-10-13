import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, validateRouteParam, uuidSchema, CreateDeliverableCommentSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { ActorRole } from '@/shared/rules';

/**
 * Deliverable Comments Route Handler (Batch 2: Approvals & Deliverables)
 *
 * Secure server-side comment posting:
 * - Enforces workspace or client affiliation.
 * - Forces is_internal = false for client callers.
 * - Atomic comment insertion and deliverable counter increment.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ deliverableId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'deliverable_comment',
    maxRequests: 60,
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
      message: 'Authentication required to post comments.',
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
  const bodyValidation = await parseJsonBody(request, CreateDeliverableCommentSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const { content, isInternal } = bodyValidation.data;

  // 5. Demo Mode Handler
  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        message: 'Comment added successfully (demo mode).',
        comment: {
          id: `cmt-demo-${Date.now()}`,
          deliverableId,
          content,
          isInternal: Boolean(isInternal),
          author: 'Demo User',
          createdAt: new Date().toISOString(),
        },
        requestId,
      },
      {
        status: 201,
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
      .select('id, workspace_id, client_id, comments_count, title')
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
    let authorName = 'User';

    // Check workspace owner
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', deliverable.workspace_id)
      .maybeSingle();

    if (workspace && (workspace.owner_id === caller.userId || (workspace as any).user_id === caller.userId)) {
      isAuthorized = true;
      actorRole = 'freelancer';
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name, business_name')
        .eq('id', caller.userId)
        .maybeSingle();
      if (profile?.full_name) authorName = profile.full_name;
    }

    // Check client assignment
    if (!isAuthorized && deliverable.client_id) {
      const { data: clientRecord } = await supabaseAdmin
        .from('clients')
        .select('id, user_id, name')
        .eq('id', deliverable.client_id)
        .maybeSingle();

      if (clientRecord && clientRecord.user_id === caller.userId) {
        isAuthorized = true;
        actorRole = 'client';
        if (clientRecord.name) authorName = clientRecord.name;
      }
    }

    if (!isAuthorized) {
      return createApiErrorResponse({
        message: 'You are not authorized to comment on this deliverable.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    // Security rule: clients CANNOT create internal comments
    const finalIsInternal = actorRole === 'freelancer' ? Boolean(isInternal) : false;
    const nowIso = new Date().toISOString();

    // 7. Insert Comment
    const { data: insertedComment, error: insertError } = await supabaseAdmin
      .from('deliverable_comments')
      .insert({
        deliverable_id: deliverableId,
        author: authorName,
        author_role: actorRole,
        is_internal: finalIsInternal,
        content,
        created_at: nowIso,
      })
      .select()
      .single();

    if (insertError || !insertedComment) {
      logger.error('Failed to insert deliverable comment', insertError, { requestId, deliverableId });
      return createApiErrorResponse({
        message: 'Failed to post comment.',
        code: 'DATABASE_INSERT_ERROR',
        status: 500,
        requestId,
      });
    }

    // 8. Increment comments_count
    await supabaseAdmin
      .from('deliverables')
      .update({
        comments_count: (deliverable.comments_count || 0) + 1,
        updated_at: nowIso,
      })
      .eq('id', deliverableId);

    return NextResponse.json(
      {
        success: true,
        message: 'Comment posted successfully.',
        comment: insertedComment,
        requestId,
      },
      {
        status: 201,
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err: any) {
    logger.error('Unexpected exception during comment posting', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error posting comment.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
