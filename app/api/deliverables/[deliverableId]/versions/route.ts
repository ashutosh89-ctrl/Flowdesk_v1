import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, validateRouteParam, uuidSchema, CreateDeliverableVersionSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

/**
 * Deliverable Version Creation Route Handler (Batch 2: Approvals & Deliverables)
 *
 * Secure server-side version increments:
 * - Restricted to authenticated workspace owner.
 * - Atomically registers new version record and updates current_version on deliverable.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ deliverableId: string }> }
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'deliverable_version',
    maxRequests: 20,
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
      message: 'Authentication required to create deliverable versions.',
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
  const bodyValidation = await parseJsonBody(request, CreateDeliverableVersionSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const payload = bodyValidation.data;

  // 5. Demo Mode Handler
  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        message: 'New deliverable version created (demo mode).',
        version: {
          id: `ver-demo-${Date.now()}`,
          deliverableId,
          versionNumber: 'v2.0',
          note: payload.note || '',
          fileName: payload.fileName || '',
          fileUrl: payload.fileUrl || '',
          fileSize: payload.fileSize || '',
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
      .select('id, workspace_id, client_id, current_version, title')
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

    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', deliverable.workspace_id)
      .maybeSingle();

    if (!workspace || (workspace.owner_id !== caller.userId && (workspace as any).user_id !== caller.userId)) {
      return createApiErrorResponse({
        message: 'Only the workspace owner can upload deliverable versions.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    // 7. Calculate next version string
    const currentVer = deliverable.current_version || 'v1.0';
    const match = currentVer.match(/v?(\d+)(?:\.(\d+))?/);
    let nextVersionStr = 'v2.0';
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = match[2] ? parseInt(match[2], 10) : 0;
      nextVersionStr = `v${major}.${minor + 1}`;
    }

    const nowIso = new Date().toISOString();

    // 8. Insert Version Record
    const { data: insertedVersion, error: insertError } = await supabaseAdmin
      .from('deliverable_versions')
      .insert({
        deliverable_id: deliverableId,
        version_number: nextVersionStr,
        note: payload.note || '',
        file_name: payload.fileName || '',
        file_url: payload.fileUrl || '',
        file_size: payload.fileSize || '',
        uploaded_by: caller.userId,
        created_at: nowIso,
      })
      .select()
      .single();

    if (insertError || !insertedVersion) {
      logger.error('Failed to insert deliverable version', insertError, { requestId, deliverableId });
      return createApiErrorResponse({
        message: 'Failed to record deliverable version.',
        code: 'DATABASE_INSERT_ERROR',
        status: 500,
        requestId,
      });
    }

    // 9. Update Deliverable current_version
    await supabaseAdmin
      .from('deliverables')
      .update({
        current_version: nextVersionStr,
        updated_at: nowIso,
      })
      .eq('id', deliverableId);

    // 10. Activity Log
    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: deliverable.workspace_id,
        client_id: deliverable.client_id,
        action: 'uploaded_deliverable_version',
        title: `Uploaded Version ${nextVersionStr}`,
        description: `Version ${nextVersionStr} added to "${deliverable.title}".`,
        resource_type: 'deliverable',
        resource_id: deliverableId,
      });
    } catch { /* non-critical */ }

    logger.security('DELIVERABLE_VERSION_CREATED', {
      requestId,
      status: 'SUCCESS',
      deliverableId,
      version: nextVersionStr,
      workspaceId: deliverable.workspace_id,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Version ${nextVersionStr} created successfully.`,
        version: insertedVersion,
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
    logger.error('Unexpected exception during version creation', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error creating version.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
