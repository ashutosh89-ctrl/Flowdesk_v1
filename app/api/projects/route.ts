import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, CreateProjectSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { assertWithinLimit } from '@/backend/billing';
import { PlanLimitError } from '@/shared/billing';

/**
 * Projects API Route Handler
 * 
 * - GET: List workspace projects
 * - POST: Create project with strict server-side subscription quota enforcement
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'projects_get',
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

  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required to list projects.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  if (isDemoModeActive() || caller.isDemo) {
    const { FlowDeskStore } = await import('@/backend/store/storage-store');
    const projects = FlowDeskStore.getProjects();
    return NextResponse.json({
      success: true,
      projects,
      requestId,
    });
  }

  try {
    let workspaceId = caller.workspaceId;
    if (!workspaceId && caller.userId) {
      const { data: ws } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', caller.userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (ws) workspaceId = ws.id;
    }

    if (!workspaceId) {
      return NextResponse.json({ success: true, projects: [], requestId });
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to query projects', { error, workspaceId, requestId });
      return createApiErrorResponse({
        message: 'Failed to retrieve projects.',
        code: 'DATABASE_ERROR',
        status: 500,
        requestId,
      });
    }

    return NextResponse.json({
      success: true,
      projects: data || [],
      requestId,
    });
  } catch (err: any) {
    return createApiErrorResponse({
      message: 'Internal server error.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'project_create',
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
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return createApiErrorResponse({
      message: 'Authentication required to create projects.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  // 3. Request Body Validation
  const bodyValidation = await parseJsonBody(request, CreateProjectSchema, {
    maxBytes: 15 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const payload = bodyValidation.data;

  // 4. Demo Mode Handler
  if (isDemoModeActive() || caller.isDemo) {
    const { FlowDeskStore } = await import('@/backend/store/storage-store');
    const newProject = FlowDeskStore.createProject({
      clientId: payload.clientId,
      clientName: payload.clientName || 'Demo Client',
      title: payload.title,
      description: payload.description || '',
      status: payload.status || 'in_progress',
      budget: payload.budget || 0,
      startDate: payload.startDate || new Date().toISOString().split('T')[0],
      dueDate: payload.dueDate || new Date().toISOString().split('T')[0],
      tags: payload.tags || [],
      milestones: (payload.milestones as any) || [],
    } as any);

    return NextResponse.json(
      {
        success: true,
        message: 'Project created successfully (demo mode).',
        project: newProject,
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

  // 5. Production DB Execution & Quota Authorization
  try {
    let workspaceId = caller.workspaceId;

    if (!workspaceId) {
      const { data: ws } = await supabaseAdmin
        .from('workspaces')
        .select('id, name')
        .eq('owner_id', caller.userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!ws || !ws.id) {
        return createApiErrorResponse({
          message: 'Workspace not found. Please complete profile setup first.',
          code: 'WORKSPACE_NOT_FOUND',
          status: 404,
          requestId,
        });
      }
      workspaceId = ws.id;
    }

    if (!workspaceId) {
      return createApiErrorResponse({
        message: 'Valid workspace required.',
        code: 'WORKSPACE_REQUIRED',
        status: 400,
        requestId,
      });
    }

    // 6. Strict Server-Side Quota Enforcement (S-03)
    try {
      await assertWithinLimit(workspaceId, 'activeProjects', 1);
    } catch (err: any) {
      if (err instanceof PlanLimitError) {
        logger.warn('Project creation blocked by subscription entitlement limit', {
          workspaceId,
          code: err.code,
          metric: err.metric,
          limit: err.limit,
          current: err.current,
        });
        return createApiErrorResponse({
          message: err.message,
          code: 'PLAN_LIMIT_EXCEEDED',
          status: 403,
          requestId,
        });
      }
      throw err;
    }

    // Verify client belongs to workspace
    const { data: clientRecord, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('id, name')
      .eq('id', payload.clientId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (clientErr || !clientRecord) {
      return createApiErrorResponse({
        message: 'Selected client does not exist or does not belong to your workspace.',
        code: 'CLIENT_NOT_FOUND',
        status: 400,
        requestId,
      });
    }

    const effectiveClientName = clientRecord.name || payload.clientName || 'Client';

    const insertPayload = {
      workspace_id: workspaceId,
      user_id: caller.userId,
      client_id: payload.clientId,
      client_name: effectiveClientName,
      title: payload.title,
      description: payload.description || '',
      status: payload.status || 'in_progress',
      budget: payload.budget || 0,
      spent: 0,
      completion_percentage: 0,
      start_date: payload.startDate || new Date().toISOString().split('T')[0],
      due_date: payload.dueDate || new Date().toISOString().split('T')[0],
      tags: payload.tags || [],
      milestones: payload.milestones || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: project, error: insertError } = await supabaseAdmin
      .from('projects')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError || !project) {
      logger.error('Failed to insert project into database', insertError, { requestId });
      return createApiErrorResponse({
        message: 'Failed to create project in database.',
        code: 'DATABASE_INSERT_ERROR',
        status: 500,
        requestId,
      });
    }

    // Log activity
    try {
      await supabaseAdmin.from('activities').insert({
        workspace_id: workspaceId,
        client_id: payload.clientId,
        action: 'created_project',
        title: 'Project Created',
        description: `Created project "${project.title}" for ${effectiveClientName}`,
        resource_type: 'project',
        resource_id: project.id,
      });
    } catch {
      // Non-critical audit activity
    }

    logger.security('PROJECT_CREATED', {
      requestId,
      status: 'SUCCESS',
      workspaceId,
      projectId: project.id,
      userId: caller.userId,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Project created successfully.',
        project: {
          id: project.id,
          clientId: project.client_id,
          clientName: project.client_name,
          title: project.title,
          description: project.description,
          status: project.status,
          budget: Number(project.budget) || 0,
          spent: Number(project.spent) || 0,
          startDate: project.start_date,
          dueDate: project.due_date,
          completionPercentage: project.completion_percentage || 0,
          tags: project.tags || [],
          milestones: project.milestones || [],
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
  } catch (err: any) {
    logger.error('Unexpected exception during project creation', err, { requestId });
    return createApiErrorResponse({
      message: 'Internal server error creating project.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

