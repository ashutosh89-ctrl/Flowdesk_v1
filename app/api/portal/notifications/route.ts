import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { logger, getOrCreateRequestId, createApiErrorResponse } from '@/backend/utilities/logger';

export const runtime = 'nodejs';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Client Portal Notifications Route
 *
 * GET /api/portal/notifications?clientId=[clientId]
 * Retrieves recent notifications strictly scoped to the specified client.
 *
 * POST /api/portal/notifications
 * Marks client notifications as read.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'portal_notifs_get',
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

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId')?.trim();

  if (!clientId) {
    return createApiErrorResponse({
      message: 'Client ID is required.',
      code: 'BAD_REQUEST',
      status: 400,
      requestId,
    });
  }

  if (isDemoModeActive()) {
    return NextResponse.json(
      {
        success: true,
        notifications: [],
        requestId,
      },
      {
        headers: {
          'X-Request-Id': requestId,
          'Cache-Control': 'no-store, must-revalidate',
        },
      }
    );
  }

  try {
    const db = supabaseAdmin;
    if (!db) {
      return NextResponse.json({ success: true, notifications: [], requestId });
    }

    // Resolve canonical client ID and linked user ID
    let candidateIds: string[] = [clientId];
    let resolvedClientId = clientId;

    const { data: clientMatches } = await db
      .from('clients')
      .select('id, user_id')
      .or(`id.eq.${clientId},user_id.eq.${clientId},portal_token.eq.${clientId},email.eq.${clientId.toLowerCase()}`);

    if (clientMatches && clientMatches.length > 0) {
      for (const cm of clientMatches) {
        if (cm.id) {
          candidateIds.push(cm.id);
          resolvedClientId = cm.id;
        }
        if (cm.user_id) candidateIds.push(cm.user_id);
      }
      candidateIds = Array.from(new Set(candidateIds));
    }

    const { data: notifRows, error } = await db
      .from('notifications')
      .select('id, title, message, category, priority, read, created_at, link')
      .or(`client_id.in.(${candidateIds.join(',')}),user_id.in.(${candidateIds.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      logger.warn('Failed to query client notifications', { error: error.message, clientId: resolvedClientId });
      return NextResponse.json({ success: true, notifications: [], requestId });
    }

    const notifications = (notifRows || []).map((n) => ({
      id: n.id,
      clientId: resolvedClientId,
      title: n.title,
      message: n.message,
      read: Boolean(n.read),
      timestamp: n.created_at ? n.created_at.split('T')[0] : 'Recent',
      priority: (n.priority as 'high' | 'medium' | 'low') || 'low',
      type: (n.category as any) || 'comment',
      link: n.link || undefined,
    }));

    return NextResponse.json(
      {
        success: true,
        notifications,
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
    logger.error('Unexpected error fetching portal notifications', err, { requestId });
    return NextResponse.json({ success: true, notifications: [], requestId });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'portal_notifs_post',
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

  try {
    const body = await request.json().catch(() => ({}));
    const clientId = body?.clientId?.trim();
    const action = body?.action || 'markAllRead';
    const notificationId = body?.notificationId;

    if (!clientId) {
      return createApiErrorResponse({
        message: 'Client ID is required.',
        code: 'BAD_REQUEST',
        status: 400,
        requestId,
      });
    }

    if (isDemoModeActive()) {
      return NextResponse.json({ success: true, requestId });
    }

    const db = supabaseAdmin;
    if (!db) {
      return NextResponse.json({ success: true, requestId });
    }

    // Resolve all possible candidate IDs (client id, linked user_id, portal_token)
    let candidateIds: string[] = [clientId];
    let resolvedClientId = clientId;

    const { data: clientMatches } = await db
      .from('clients')
      .select('id, user_id')
      .or(`id.eq.${clientId},user_id.eq.${clientId},portal_token.eq.${clientId},email.eq.${clientId.toLowerCase()}`);

    if (clientMatches && clientMatches.length > 0) {
      for (const cm of clientMatches) {
        if (cm.id) {
          candidateIds.push(cm.id);
          resolvedClientId = cm.id;
        }
        if (cm.user_id) candidateIds.push(cm.user_id);
      }
      candidateIds = Array.from(new Set(candidateIds.filter(Boolean)));
    }

    if (action === 'markRead' && notificationId) {
      await db
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
    } else if (action === 'delete' && notificationId) {
      await db
        .from('notifications')
        .delete()
        .eq('id', notificationId);
    } else {
      await Promise.all([
        db.from('notifications').update({ read: true }).in('client_id', candidateIds),
        db.from('notifications').update({ read: true }).in('user_id', candidateIds),
      ]);
    }

    return NextResponse.json({ success: true, requestId });
  } catch (err: any) {
    logger.error('Unexpected error updating portal notifications', err, { requestId });
    return NextResponse.json({ success: false, error: 'Failed to update notifications' }, { status: 500 });
  }
}
