import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isDemoModeActive } from '@/backend/utilities/supabase';
import { requireApiCaller } from '@/backend/utilities/api-auth';
import { checkRateLimit, getClientIp } from '@/backend/utilities/rate-limiter';
import { createApiErrorResponse, getOrCreateRequestId, logger } from '@/backend/utilities/logger';

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'comments_get',
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

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId')?.trim();

  if (!clientId) {
    return createApiErrorResponse({
      message: 'clientId query parameter is required',
      code: 'BAD_REQUEST',
      status: 400,
      requestId,
    });
  }

  const caller = await requireApiCaller();
  if (!caller && !isDemoModeActive()) {
    return createApiErrorResponse({
      message: 'Authentication required to view workspace comments.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  try {
    const client = supabaseAdmin;

    // Check client authorization
    let isOwner = false;
    if (caller && !caller.isDemo) {
      const { data: clientRec } = await client
        .from('clients')
        .select('workspace_id, user_id')
        .eq('id', clientId)
        .maybeSingle();

      if (!clientRec) {
        return NextResponse.json({ success: true, comments: [], requestId });
      }

      const isWorkspaceOwner = caller.workspaceId && caller.workspaceId === clientRec.workspace_id;
      const isClientUser = clientRec.user_id === caller.userId || (caller.clientId && caller.clientId === clientId);

      if (!isWorkspaceOwner && !isClientUser) {
        const { data: conn } = await client
          .from('client_connections')
          .select('id')
          .eq('client_id', clientId)
          .eq('client_user_id', caller.userId)
          .eq('status', 'active')
          .maybeSingle();

        if (!conn) {
          return NextResponse.json({ success: true, comments: [], requestId });
        }
      }

      isOwner = Boolean(isWorkspaceOwner);
    }

    let query = client
      .from('workspace_comments')
      .select('*')
      .eq('client_id', clientId);

    // Only workspace owners may see internal comments
    if (!isOwner) {
      query = query.eq('is_internal', false);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      logger.warn('Database error fetching comments in API:', { error: error.message, clientId });
      return NextResponse.json({ success: true, comments: [], requestId });
    }

    return NextResponse.json({ success: true, comments: data || [], requestId });
  } catch (err: any) {
    logger.error('Failed to get comments in API route:', err, { requestId });
    return NextResponse.json({ success: true, comments: [], requestId });
  }
}

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
  const ip = getClientIp(request);

  const rateLimit = await checkRateLimit(ip, {
    prefix: 'comments_post',
    maxRequests: 30,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return createApiErrorResponse({
      message: 'Too many requests. Please wait a moment before posting again.',
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      requestId,
    });
  }

  const caller = await requireApiCaller();
  if (!caller && !isDemoModeActive()) {
    return createApiErrorResponse({
      message: 'Authentication required to post comments.',
      code: 'UNAUTHORIZED',
      status: 401,
      requestId,
    });
  }

  try {
    const body = await request.json();
    const { clientId, text, author, avatar, replyToId, replyToAuthor, replyToText, isInternal } = body || {};

    if (!clientId || !text || !text.trim()) {
      return createApiErrorResponse({
        message: 'clientId and non-empty text are required',
        code: 'BAD_REQUEST',
        status: 400,
        requestId,
      });
    }

    const client = supabaseAdmin;

    // 1. Resolve client and verify caller authorization
    const { data: clientRec } = await client
      .from('clients')
      .select('id, workspace_id, name, user_id')
      .eq('id', clientId)
      .maybeSingle();

    if (!clientRec?.workspace_id) {
      return createApiErrorResponse({
        message: 'Client workspace not found.',
        code: 'NOT_FOUND',
        status: 404,
        requestId,
      });
    }

    let isOwner = false;
    if (caller && !caller.isDemo) {
      const isWorkspaceOwner = caller.workspaceId && caller.workspaceId === clientRec.workspace_id;
      const isClientUser = clientRec.user_id === caller.userId || (caller.clientId && caller.clientId === clientId);

      if (!isWorkspaceOwner && !isClientUser) {
        const { data: conn } = await client
          .from('client_connections')
          .select('id')
          .eq('client_id', clientId)
          .eq('client_user_id', caller.userId)
          .eq('status', 'active')
          .maybeSingle();

        if (!conn) {
          return createApiErrorResponse({
            message: 'You are not authorized to post comments in this workspace.',
            code: 'FORBIDDEN',
            status: 403,
            requestId,
          });
        }
      }

      isOwner = Boolean(isWorkspaceOwner);
    }

    // Role is authoritative: derived from session, NOT client body
    const effectiveIsInternal = isOwner ? Boolean(isInternal) : false;
    const authorRole = isOwner ? 'freelancer' : 'client';

    const payload: any = {
      workspace_id: clientRec.workspace_id,
      client_id: clientId,
      author: author || clientRec.name || (isOwner ? 'Freelancer' : 'Client'),
      author_avatar: avatar || null,
      author_role: authorRole,
      text: text.trim().slice(0, 5000),
      is_owner: isOwner,
      is_internal: effectiveIsInternal,
      reply_to_id: replyToId || null,
      reply_to_author: replyToAuthor || null,
      reply_to_text: replyToText || null,
    };

    const { data, error } = await client
      .from('workspace_comments')
      .insert(payload)
      .select()
      .single();

    if (error) {
      logger.error('Database error creating workspace comment', error, { requestId });
      return createApiErrorResponse({
        message: 'Failed to record comment.',
        code: 'DATABASE_ERROR',
        status: 500,
        requestId,
      });
    }

    // Non-blocking activity log
    try {
      await client.from('activities').insert({
        workspace_id: clientRec.workspace_id,
        action: 'posted_comment',
        title: isOwner ? 'Freelancer Update' : 'Client Discussion Note',
        description: text.trim().slice(0, 200),
        user_name: payload.author,
        resource_type: 'comment',
        client_id: clientId,
      });
    } catch {
      // Activity logging is non-blocking
    }

    return NextResponse.json({ success: true, comment: data, requestId });
  } catch (err: any) {
    logger.error('API route exception posting comment', err, { requestId });
    return createApiErrorResponse({
      message: 'Failed to post comment.',
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId,
    });
  }
}
