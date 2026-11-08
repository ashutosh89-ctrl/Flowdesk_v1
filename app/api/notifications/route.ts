import { NextRequest, NextResponse } from 'next/server';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, createApiErrorResponse, getOrCreateRequestId } from '@/backend/utilities/logger';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';

export const runtime = 'nodejs';

/**
 * Freelancer In-App Notifications API
 *
 * GET /api/notifications
 * Lists in-app notifications belonging to the authenticated freelancer's workspace.
 * Strictly prevents cross-workspace and client-facing notification leakage.
 *
 * PATCH /api/notifications
 * Updates notification read state:
 * - { action: 'markRead', id: string }
 * - { action: 'markUnread', id: string }
 * - { action: 'markAllRead' }
 *
 * DELETE /api/notifications
 * Deletes a notification:
 * - { id: string }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  // 1. Rate Limiting
  const rateLimit = await checkRateLimit(ip, {
    prefix: 'notifications_get',
    maxRequests: 120,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many requests.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  // 2. Authentication
  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  if (isDemoModeActive() || caller.isDemo) {
    return NextResponse.json({
      success: true,
      notifications: [],
      unreadCount: 0,
      requestId,
    });
  }

  try {
    const db = supabaseAdmin;
    if (!db) {
      return NextResponse.json({ success: true, notifications: [], unreadCount: 0, requestId });
    }

    let wsId = caller.workspaceId;
    if (!wsId && caller.userId) {
      const { data: ws } = await db
        .from('workspaces')
        .select('id')
        .eq('owner_id', caller.userId)
        .limit(1)
        .maybeSingle();
      if (ws?.id) wsId = ws.id;
    }

    if (!wsId) {
      return NextResponse.json({ success: true, notifications: [], unreadCount: 0, requestId });
    }

    // Query notifications for this workspace intended for the freelancer (client_id is null)
    const { data: rows, error } = await db
      .from('notifications')
      .select('id, title, message, category, read, created_at, link')
      .eq('workspace_id', wsId)
      .is('client_id', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.warn('Failed to query notifications', { error: error.message, workspaceId: wsId });
      return NextResponse.json({ success: true, notifications: [], unreadCount: 0, requestId });
    }

    const notifications = (rows || []).map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      read: Boolean(n.read),
      timestamp: n.created_at ? n.created_at.split('T')[0] : 'Recent',
      type: n.category || 'info',
      link: n.link || undefined,
    }));

    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json(
      {
        success: true,
        notifications,
        unreadCount,
        requestId,
      },
      {
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    logger.error('Unexpected error fetching notifications', err, { requestId });
    return NextResponse.json({ success: true, notifications: [], unreadCount: 0, requestId });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'notifications_patch',
    maxRequests: 60,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many requests.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  if (isDemoModeActive() || caller.isDemo) {
    return NextResponse.json({ success: true, requestId });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action || 'markAllRead';
    const notificationId = body?.id;

    const db = supabaseAdmin;
    if (!db) {
      return NextResponse.json({ success: true, requestId });
    }

    let wsId = caller.workspaceId;
    if (!wsId && caller.userId) {
      const { data: ws } = await db
        .from('workspaces')
        .select('id')
        .eq('owner_id', caller.userId)
        .limit(1)
        .maybeSingle();
      if (ws?.id) wsId = ws.id;
    }

    if (!wsId) {
      return createApiErrorResponse({
        message: 'No active workspace found.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    if (action === 'markRead' && notificationId) {
      // Validate notification belongs to caller's workspace
      const { error } = await db
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('workspace_id', wsId);

      if (error) throw error;
    } else if (action === 'markUnread' && notificationId) {
      const { error } = await db
        .from('notifications')
        .update({ read: false })
        .eq('id', notificationId)
        .eq('workspace_id', wsId);

      if (error) throw error;
    } else if (action === 'markAllRead') {
      // Strictly mark only this workspace's freelancer notifications as read
      const { error } = await db
        .from('notifications')
        .update({ read: true })
        .eq('workspace_id', wsId)
        .is('client_id', null);

      if (error) throw error;
    } else {
      return createApiErrorResponse({
        message: 'Invalid action or missing notification ID.',
        code: 'BAD_REQUEST',
        status: 400,
        requestId,
      });
    }

    return NextResponse.json({ success: true, requestId });
  } catch (err: any) {
    logger.error('Unexpected error updating notifications', err, { requestId });
    return createApiErrorResponse({
      message: err?.message || 'Failed to update notifications.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'notifications_delete',
    maxRequests: 60,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many requests.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  const caller = await requireApiCaller();
  if (!caller) {
    return createApiErrorResponse({
      message: 'Authentication required.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  if (isDemoModeActive() || caller.isDemo) {
    return NextResponse.json({ success: true, requestId });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const notificationId = body?.id;

    if (!notificationId) {
      return createApiErrorResponse({
        message: 'Notification ID is required.',
        code: 'BAD_REQUEST',
        status: 400,
        requestId,
      });
    }

    const db = supabaseAdmin;
    if (!db) {
      return NextResponse.json({ success: true, requestId });
    }

    let wsId = caller.workspaceId;
    if (!wsId && caller.userId) {
      const { data: ws } = await db
        .from('workspaces')
        .select('id')
        .eq('owner_id', caller.userId)
        .limit(1)
        .maybeSingle();
      if (ws?.id) wsId = ws.id;
    }

    if (!wsId) {
      return createApiErrorResponse({
        message: 'No active workspace found.',
        code: 'FORBIDDEN',
        status: 403,
        requestId,
      });
    }

    const { error } = await db
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('workspace_id', wsId);

    if (error) throw error;

    return NextResponse.json({ success: true, requestId });
  } catch (err: any) {
    logger.error('Unexpected error deleting notification', err, { requestId });
    return createApiErrorResponse({
      message: err?.message || 'Failed to delete notification.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
