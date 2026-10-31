import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabase } from '@/backend/utilities/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const role = searchParams.get('role') || 'client';

  if (!clientId) {
    return NextResponse.json({ error: 'clientId query parameter is required' }, { status: 400 });
  }

  try {
    const client = supabaseAdmin || supabase;
    let query = client
      .from('workspace_comments')
      .select('*')
      .eq('client_id', clientId);

    if (role === 'client') {
      query = query.eq('is_internal', false);
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) {
      console.warn('Database error fetching comments in API:', error.message);
      return NextResponse.json({ success: true, comments: [] });
    }

    return NextResponse.json({ success: true, comments: data || [] });
  } catch (err: any) {
    console.error('Failed to get comments in API route:', err);
    return NextResponse.json({ success: true, comments: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, text, author, avatar, replyToId, replyToAuthor, replyToText, isInternal, isOwner } = body || {};

    if (!clientId || !text || !text.trim()) {
      return NextResponse.json({ success: false, error: 'clientId and non-empty text are required' }, { status: 400 });
    }

    const client = supabaseAdmin || supabase;

    // 1. Resolve workspace_id for the client
    let workspaceId: string | null = null;
    const { data: clientRec } = await client
      .from('clients')
      .select('workspace_id, name')
      .eq('id', clientId)
      .maybeSingle();

    if (clientRec?.workspace_id) {
      workspaceId = clientRec.workspace_id;
    } else {
      const { data: wsRec } = await client
        .from('workspaces')
        .select('id')
        .limit(1)
        .maybeSingle();
      workspaceId = wsRec?.id || null;
    }

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'No active workspace found for this client context.' }, { status: 400 });
    }

    const payload: any = {
      workspace_id: workspaceId,
      client_id: clientId,
      author: author || clientRec?.name || (isOwner ? 'Freelancer' : 'Client'),
      author_avatar: avatar || null,
      author_role: isOwner ? 'freelancer' : 'client',
      text: text.trim(),
      is_owner: Boolean(isOwner),
      is_internal: Boolean(isInternal),
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
      console.error('Supabase error creating workspace comment:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    // Log activity
    try {
      await client.from('activities').insert({
        workspace_id: workspaceId,
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

    return NextResponse.json({ success: true, comment: data });
  } catch (err: any) {
    console.error('API route exception posting comment:', err);
    return NextResponse.json({ success: false, error: err.message || 'Server error' }, { status: 500 });
  }
}
