import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { parseJsonBody, UpdateTaskSchema } from '@/shared/validation';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { taskId } = await context.params;
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'task_patch',
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
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return createApiErrorResponse({
      message: 'Authentication required to update tasks.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  const bodyValidation = await parseJsonBody(request, UpdateTaskSchema, {
    maxBytes: 10 * 1024,
  });
  if (!bodyValidation.success) {
    return bodyValidation.response;
  }
  const updates = bodyValidation.data;

  if (isDemoModeActive() || caller.isDemo) {
    const { FlowDeskStore } = await import('@/backend/store/storage-store');
    const updated = FlowDeskStore.updateTask(taskId, updates as any);
    return NextResponse.json({
      success: true,
      message: 'Task updated successfully (demo mode).',
      task: updated,
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

    const payload: any = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.priority !== undefined) payload.priority = updates.priority;
    if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
    if (updates.projectId !== undefined) payload.project_id = updates.projectId;
    if (updates.clientId !== undefined) payload.client_id = updates.clientId;

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .update(payload)
      .eq('id', taskId)
      .eq('workspace_id', workspaceId)
      .select()
      .maybeSingle();

    if (error || !data) {
      return createApiErrorResponse({
        message: 'Task update failed or task not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Task updated successfully.',
      task: data,
      requestId,
    });
  } catch (err: any) {
    return createApiErrorResponse({
      message: 'Internal server error updating task.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { taskId } = await context.params;
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const caller = await requireApiCaller();
  if (!caller || (!caller.isDemo && !caller.userId)) {
    return createApiErrorResponse({
      message: 'Authentication required to delete tasks.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  if (isDemoModeActive() || caller.isDemo) {
    const { FlowDeskStore } = await import('@/backend/store/storage-store');
    FlowDeskStore.deleteTask(taskId);
    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully (demo mode).',
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

    const { error } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('workspace_id', workspaceId);

    if (error) {
      return createApiErrorResponse({
        message: 'Failed to delete task.',
        code: 'DATABASE_ERROR',
        status: 500,
        requestId,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully.',
      requestId,
    });
  } catch (err: any) {
    return createApiErrorResponse({
      message: 'Internal server error deleting task.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

