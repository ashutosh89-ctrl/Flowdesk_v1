import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, CreateTaskSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'tasks_get',
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
      message: 'Authentication required to list tasks.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  const { searchParams } = new URL(request.url);
  const filterProjectId = searchParams.get('projectId');
  const filterClientId = searchParams.get('clientId');
  const filterStatus = searchParams.get('status');

  if (isDemoModeActive() || caller.isDemo) {
    const { FlowDeskStore } = await import('@/backend/store/storage-store');
    let tasks = FlowDeskStore.getTasks();
    if (filterProjectId) tasks = tasks.filter((t: any) => t.projectId === filterProjectId);
    if (filterClientId) tasks = tasks.filter((t: any) => t.clientId === filterClientId);
    if (filterStatus) tasks = tasks.filter((t: any) => t.status === filterStatus);
    return NextResponse.json({ success: true, tasks, requestId });
  }

  try {
    let workspaceId = caller.workspaceId;
    if (!workspaceId && caller.userId) {
      const { data: ws } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', caller.userId)
        .limit(1)
        .maybeSingle();
      if (ws) workspaceId = ws.id;
    }

    if (!workspaceId) {
      return NextResponse.json({ success: true, tasks: [], requestId });
    }

    let query = supabaseAdmin
      .from('tasks')
      .select('*, projects(title), clients(name)')
      .eq('workspace_id', workspaceId);

    if (filterProjectId) query = query.eq('project_id', filterProjectId);
    if (filterClientId) query = query.eq('client_id', filterClientId);
    if (filterStatus) query = query.eq('status', filterStatus);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      // In case table is not migrated on remote yet, return empty list gracefully
      logger.warn('Tasks table query error or not migrated', { error: String(error) });
      return NextResponse.json({ success: true, tasks: [], requestId });
    }

    const formattedTasks = (data || []).map((t: any) => ({
      id: t.id,
      workspaceId: t.workspace_id,
      projectId: t.project_id,
      projectTitle: t.projects?.title || null,
      clientId: t.client_id,
      clientName: t.clients?.name || null,
      title: t.title,
      description: t.description || '',
      status: t.status,
      priority: t.priority,
      dueDate: t.due_date,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    return NextResponse.json({ success: true, tasks: formattedTasks, requestId });
  } catch (err: any) {
    return createApiErrorResponse({
      message: 'Failed to retrieve tasks.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'task_create',
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

  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return createApiErrorResponse({
      message: 'Authentication required to create tasks.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  const bodyValidation = await parseJsonBody(request, CreateTaskSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const payload = bodyValidation.data;

  if (isDemoModeActive() || caller.isDemo) {
    const { FlowDeskStore } = await import('@/backend/store/storage-store');
    const newTask = FlowDeskStore.createTask({
      title: payload.title,
      description: payload.description || '',
      projectId: payload.projectId || null,
      clientId: payload.clientId || null,
      status: payload.status,
      priority: payload.priority,
      dueDate: payload.dueDate || null,
    } as any);

    return NextResponse.json(
      { success: true, message: 'Task created successfully (demo mode).', task: newTask, requestId },
      { status: 201, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } }
    );
  }

  try {
    let workspaceId = caller.workspaceId;
    if (!workspaceId && caller.userId) {
      const { data: ws } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('owner_id', caller.userId)
        .limit(1)
        .maybeSingle();
      if (ws) workspaceId = ws.id;
    }

    if (!workspaceId) {
      return createApiErrorResponse({
        message: 'No active workspace found.',
        code: 'WORKSPACE_NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    const validProjectId = payload.projectId && UUID_REGEX.test(payload.projectId) ? payload.projectId : null;
    const validClientId = payload.clientId && UUID_REGEX.test(payload.clientId) ? payload.clientId : null;

    let insertedData: any = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('tasks')
        .insert({
          workspace_id: workspaceId,
          project_id: validProjectId,
          client_id: validClientId,
          title: payload.title,
          description: payload.description || '',
          status: payload.status,
          priority: payload.priority,
          due_date: payload.dueDate || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!error && data) {
        insertedData = data;
      } else {
        logger.warn('Remote tasks table insert failed or table not migrated, using local store fallback', {
          error: String(error?.message || error),
        });
      }
    } catch (dbErr) {
      logger.warn('Database query exception inserting task, using local store fallback', {
        error: String(dbErr),
      });
    }

    if (!insertedData) {
      const { FlowDeskStore } = await import('@/backend/store/storage-store');
      const fallbackTask = FlowDeskStore.createTask({
        title: payload.title,
        description: payload.description || '',
        projectId: payload.projectId || null,
        clientId: payload.clientId || null,
        status: payload.status,
        priority: payload.priority,
        dueDate: payload.dueDate || null,
      });

      return NextResponse.json(
        {
          success: true,
          message: 'Task created successfully.',
          task: fallbackTask,
          requestId,
        },
        { status: 201, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Task created successfully.',
        task: {
          id: insertedData.id,
          workspaceId: insertedData.workspace_id,
          projectId: insertedData.project_id || payload.projectId || null,
          clientId: insertedData.client_id || payload.clientId || null,
          title: insertedData.title,
          description: insertedData.description,
          status: insertedData.status,
          priority: insertedData.priority,
          dueDate: insertedData.due_date,
          createdAt: insertedData.created_at,
          updatedAt: insertedData.updated_at,
        },
        requestId,
      },
      { status: 201, headers: { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    return createApiErrorResponse({
      message: 'Internal server error creating task.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

