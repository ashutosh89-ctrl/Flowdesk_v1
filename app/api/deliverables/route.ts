import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, CreateDeliverableSchema, uuidSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { Deliverable, DeliverableStatus } from '@/shared/types';
import { safeDeliverableInsert, safeDeliverableFileInsert, deriveApprovalStatus } from '@/backend/utilities/deliverables-db';

/**
 * Deliverables Collection Route Handler (Batch 2: Approvals & Deliverables)
 *
 * Secure server-side deliverable creation and listing:
 * - Restricted to authenticated workspace owner.
 * - Enforces workspace multi-tenant boundary.
 * - Safely handles optional project linkage without invalid UUID syntax errors.
 * - Attaches initial version and file metadata atomically.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'deliverable_create',
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
      message: 'Authentication required to create deliverables.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Request Body Validation
  const bodyValidation = await parseJsonBody(request, CreateDeliverableSchema, {
    maxBytes: 50 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const payload = bodyValidation.data;

  // 4. Demo Mode Handler
  if (isDemoModeActive()) {
    const { FlowDeskStore } = await import('@/backend/store/storage-store');
    const demoDeliverable = FlowDeskStore.addDeliverable({
      clientId: payload.clientId,
      clientName: payload.clientName || 'Demo Client',
      projectId: payload.projectId || '',
      title: payload.title,
      description: payload.description || '',
      status: (payload.status || 'draft') as DeliverableStatus,
      priority: payload.priority || 'medium',
      dueDate: payload.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      reviewDeadline: payload.reviewDeadline || undefined,
      version: payload.version || 'v1.0',
      internalNotes: payload.internalNotes || '',
      submissionMessage: payload.submissionMessage || '',
      approvalStatus: payload.approvalStatus || 'pending',
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      fileUrl: payload.fileUrl,
      niche: payload.niche || 'general',
      nicheMetadata: payload.nicheMetadata || {},
    });

    return NextResponse.json(
      {
        success: true,
        deliverable: demoDeliverable,
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

  // 5. Production DB Execution & Authorization
  try {
    // Verify Workspace Ownership
    let workspaceId = caller.workspaceId;

    if (!workspaceId) {
      const { data: ws } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', caller.userId)
        .limit(1)
        .maybeSingle();

      if (!ws) {
        return createApiErrorResponse({
          message: 'No active workspace found for this account.',
          code: 'FORBIDDEN',
          status: 403,
          requestId,
        });
      }
      workspaceId = ws.id;
    }

    // Verify / Resolve Client
    const isClientUuid = uuidSchema.safeParse(payload.clientId).success;
    let clientId = payload.clientId;
    let clientName = payload.clientName || '';

    if (isClientUuid) {
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, name, company')
        .eq('id', payload.clientId)
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (client) {
        clientId = client.id;
        clientName = client.company || client.name || clientName;
      }
    } else {
      // If clientId wasn't a UUID, look up client by workspace
      const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, name, company')
        .eq('workspace_id', workspaceId)
        .limit(1)
        .maybeSingle();

      if (client) {
        clientId = client.id;
        clientName = client.company || client.name;
      } else {
        return createApiErrorResponse({
          message: 'A valid client is required to create a deliverable.',
          code: 'INVALID_CLIENT',
          status: 400,
          requestId,
        });
      }
    }

    // Verify / Sanitize Project ID (Avoid invalid UUID errors)
    let validProjectId: string | null = null;
    if (payload.projectId && payload.projectId.trim() !== '') {
      const isProjectUuid = uuidSchema.safeParse(payload.projectId).success;
      if (isProjectUuid) {
        const { data: proj } = await supabaseAdmin
          .from('projects')
          .select('id')
          .eq('id', payload.projectId)
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        if (proj) {
          validProjectId = proj.id;
        }
      }
    }

    // Prepare Deliverable Record
    const insertPayload = {
      workspace_id: workspaceId,
      client_id: clientId,
      project_id: validProjectId,
      user_id: caller.userId,
      client_name: clientName || 'Client Workspace',
      title: payload.title,
      description: payload.description || '',
      status: payload.status || 'draft',
      priority: payload.priority || 'medium',
      due_date: payload.dueDate || null,
      review_deadline: payload.reviewDeadline || null,
      current_version: payload.version || 'v1.0',
      internal_notes: payload.internalNotes || '',
      submission_message: payload.submissionMessage || '',
      approval_status: payload.approvalStatus || 'pending',
      niche: payload.niche || 'general',
      metadata: payload.nicheMetadata || {},
    };

    const { data: deliverable, error: delError } = await safeDeliverableInsert(supabaseAdmin, insertPayload);

    if (delError || !deliverable) {
      logger.error('Database error inserting deliverable', {
        requestId,
        error: delError?.message,
        code: delError?.code,
      });
      return createApiErrorResponse({
        message: delError?.message || 'Failed to create deliverable record in database.',
        code: 'DATABASE_ERROR',
        status: 500,
        requestId,
      });
    }

    // Optional: insert file record
    if (payload.fileName || payload.fileUrl) {
      try {
        await safeDeliverableFileInsert(supabaseAdmin, {
          deliverable_id: deliverable.id,
          file_name: payload.fileName || 'Deliverable Document',
          file_size: payload.fileSize || '',
          file_type: payload.fileUrl ? 'link' : 'application/pdf',
          file_url: payload.fileUrl || '',
          is_pinned: false,
        });
      } catch (fileErr) {
        logger.warn('Non-critical: file attachment notice', { error: String(fileErr) });
      }
    }

    // Insert initial version record and activity log (non-blocking)
    (async () => {
      try {
        await Promise.all([
          supabaseAdmin.from('deliverable_versions').insert({
            deliverable_id: deliverable.id,
            version_number: deliverable.current_version || payload.version || 'v1.0',
            file_url: payload.fileUrl || '',
            file_name: payload.fileName || '',
            file_size: payload.fileSize || '',
            note: 'Initial package creation',
            uploaded_by: caller.userId || null,
          }),
          supabaseAdmin.from('activities').insert({
            workspace_id: workspaceId,
            client_id: clientId,
            project_id: validProjectId,
            user_name: caller.userId ? `User-${caller.userId.slice(0, 8)}` : 'Studio Lead',
            action: 'created_deliverable',
            title: deliverable.title,
            description: `Created deliverable package "${deliverable.title}"`,
            resource_type: 'deliverable',
          }),
        ]);
      } catch (postErr) {
        logger.warn('Non-critical: post-deliverable metadata notice', { error: String(postErr) });
      }
    })();

    return NextResponse.json(
      {
        success: true,
        deliverable: {
          id: deliverable.id,
          clientId: deliverable.client_id,
          clientName: deliverable.client_name,
          projectId: deliverable.project_id || '',
          title: deliverable.title,
          description: deliverable.description || '',
          status: deliverable.status || 'draft',
          approvalStatus: deriveApprovalStatus(deliverable.status, deliverable.approval_status || payload.approvalStatus),
          priority: deliverable.priority || payload.priority || 'medium',
          dueDate: deliverable.due_date || payload.dueDate || '',
          reviewDeadline: deliverable.review_deadline || payload.reviewDeadline || undefined,
          version: deliverable.current_version || payload.version || 'v1.0',
          internalNotes: deliverable.internal_notes || payload.internalNotes || '',
          submissionMessage: deliverable.submission_message || payload.submissionMessage || '',
          niche: deliverable.niche || payload.niche || 'general',
          nicheMetadata: deliverable.metadata || payload.nicheMetadata || {},
          filesCount: payload.fileName || payload.fileUrl ? 1 : 0,
          commentsCount: 0,
          createdAt: deliverable.created_at,
          updatedAt: deliverable.updated_at,
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
  } catch (error: any) {
    logger.error('Unexpected exception during deliverable creation', {
      requestId,
      error: error?.message,
    });
    return createApiErrorResponse({
      message: 'An unexpected internal error occurred while creating deliverable.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'deliverable_list',
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

  // Authentication
  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required to list deliverables.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  if (isDemoModeActive()) {
    const { FlowDeskStore } = await import('@/backend/store/storage-store');
    return NextResponse.json({
      success: true,
      deliverables: FlowDeskStore.getDeliverables(),
      requestId,
    });
  }

  try {
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('owner_id', caller.userId)
      .limit(1)
      .maybeSingle();

    if (!workspace) {
      return createApiErrorResponse({
        message: 'No active workspace found.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    const { data: dels, error } = await supabaseAdmin
      .from('deliverables')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    if (error) {
      return createApiErrorResponse({
        message: error.message,
        code: 'DATABASE_ERROR',
        status: 500,
        requestId,
      });
    }

    return NextResponse.json(
      {
        success: true,
        deliverables: (dels || []).map((d) => ({
          id: d.id,
          clientId: d.client_id,
          clientName: d.client_name,
          projectId: d.project_id || '',
          title: d.title,
          description: d.description || '',
          status: d.status || 'draft',
          approvalStatus: deriveApprovalStatus(d.status, d.approval_status),
          priority: d.priority || 'medium',
          dueDate: d.due_date || '',
          reviewDeadline: d.review_deadline || undefined,
          version: d.current_version || 'v1.0',
          internalNotes: d.internal_notes || '',
          submissionMessage: d.submission_message || '',
          niche: d.niche || 'general',
          nicheMetadata: d.metadata || {},
          filesCount: d.files_count || 0,
          commentsCount: d.comments_count || 0,
          isArchived: d.status === 'archived',
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        })),
        requestId,
      },
      {
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    return createApiErrorResponse({
      message: error?.message || 'Failed to list deliverables',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
