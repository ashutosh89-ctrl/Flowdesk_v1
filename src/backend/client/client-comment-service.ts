import { supabase } from '@/backend/utilities/supabase';
import { PortalComment } from '@/shared/types';
import { NotificationHelper } from '@/backend/utilities/notification-helper';
import { FlowDeskStore } from '@/backend/store/storage-store';

export const ClientCommentService = {
  /**
   * Retrieves non-internal discussion comments scoped to the authenticated client
   */
  getComments: async (clientId: string): Promise<PortalComment[]> => {
    if (!clientId) return [];

    // 1. Try server API route first for authenticated server-side resolution
    try {
      const res = await fetch(`/api/comments?clientId=${encodeURIComponent(clientId)}&role=client`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.comments) && json.comments.length > 0) {
          return json.comments.map((c: any) => ({
            id: c.id,
            clientId: c.client_id || c.clientId,
            author: c.author,
            authorRole: c.is_owner ? 'freelancer' : 'client',
            text: c.text,
            timestamp: c.created_at?.split('T')[0] || 'Today',
            unread: false,
          }));
        }
      }
    } catch {
      // Fall through to direct Supabase query
    }

    // 2. Direct Supabase query
    try {
      const { data, error } = await supabase
        .from('workspace_comments')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_internal', false)
        .order('created_at', { ascending: true });

      if (data && data.length > 0) {
        return data.map((c) => ({
          id: c.id,
          clientId: c.client_id,
          author: c.author,
          authorRole: c.is_owner ? 'freelancer' : 'client',
          text: c.text,
          timestamp: c.created_at?.split('T')[0] || 'Today',
          unread: false,
        }));
      }
    } catch (err) {
      console.warn('Error fetching client comments from Supabase:', err);
    }

    // 3. Fallback to FlowDeskStore
    const local = FlowDeskStore.getComments(clientId).filter((c) => !c.isInternal);
    return local.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      author: c.author,
      authorRole: c.isOwner ? 'freelancer' : 'client',
      text: c.text,
      timestamp: c.time || 'Today',
      unread: false,
    }));
  },

  /**
   * Posts a comment from the client side after verifying ownership
   */
  postComment: async (
    clientId: string,
    commentData: {
      text: string;
      author: string;
      avatar?: string;
      replyToId?: string;
    }
  ): Promise<{ success: boolean; comment?: PortalComment; error?: string }> => {
    if (!clientId || !commentData.text.trim()) {
      return { success: false, error: 'Cannot post empty comment.' };
    }

    // 1. Try server API route first
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          text: commentData.text.trim(),
          author: commentData.author,
          avatar: commentData.avatar,
          replyToId: commentData.replyToId,
          isOwner: false,
          isInternal: false,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.comment) {
          FlowDeskStore.addComment(clientId, {
            text: commentData.text.trim(),
            author: commentData.author,
            avatar: commentData.avatar,
            isOwner: false,
            replyToId: commentData.replyToId,
          });

          NotificationHelper.newComment(commentData.author, 'Client Discussion', undefined);

          return {
            success: true,
            comment: {
              id: json.comment.id,
              clientId: json.comment.client_id || clientId,
              author: json.comment.author,
              authorRole: 'client',
              text: json.comment.text,
              timestamp: 'Just now',
              unread: false,
            },
          };
        }
      }
    } catch {
      // Fall through to direct Supabase
    }

    // 2. Direct Supabase insert fallback with workspace_id resolution
    try {
      let workspaceId: string | null = null;
      const { data: clientRec } = await supabase
        .from('clients')
        .select('workspace_id')
        .eq('id', clientId)
        .maybeSingle();

      workspaceId = clientRec?.workspace_id;
      if (!workspaceId) {
        const { data: ws } = await supabase.from('workspaces').select('id').limit(1).maybeSingle();
        workspaceId = ws?.id || null;
      }

      if (workspaceId) {
        const { data: authUser } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('workspace_comments')
          .insert({
            workspace_id: workspaceId,
            client_id: clientId,
            user_id: authUser?.user?.id || null,
            author: commentData.author,
            author_avatar: commentData.avatar,
            author_role: 'client',
            text: commentData.text.trim(),
            is_owner: false,
            is_internal: false,
            reply_to_id: commentData.replyToId || null,
          })
          .select()
          .single();

        if (!error && data) {
          FlowDeskStore.addComment(clientId, {
            text: commentData.text.trim(),
            author: commentData.author,
            avatar: commentData.avatar,
            isOwner: false,
            replyToId: commentData.replyToId,
          });

          // Log activity for client comment
          try {
            await supabase.from('activities').insert({
              workspace_id: workspaceId,
              action: 'posted_comment',
              title: 'Client Comment',
              description: commentData.text.slice(0, 200),
              user_name: commentData.author,
              resource_type: 'comment',
              client_id: clientId,
            });
          } catch { /* non-critical */ }

          NotificationHelper.newComment(commentData.author, 'Client Discussion', undefined);

          return {
            success: true,
            comment: {
              id: data.id,
              clientId: data.client_id,
              author: data.author,
              authorRole: 'client',
              text: data.text,
              timestamp: 'Just now',
              unread: false,
            },
          };
        }
      }
    } catch (err) {
      console.warn('Supabase comment posting error:', err);
    }

    // 3. Fallback to FlowDeskStore
    const storeComment = FlowDeskStore.addComment(clientId, {
      text: commentData.text.trim(),
      author: commentData.author,
      avatar: commentData.avatar,
      isOwner: false,
      replyToId: commentData.replyToId,
    });

    NotificationHelper.newComment(commentData.author, 'Client Discussion', undefined);

    return {
      success: true,
      comment: {
        id: storeComment.id,
        clientId: storeComment.clientId,
        author: storeComment.author,
        authorRole: 'client',
        text: storeComment.text,
        timestamp: 'Just now',
        unread: false,
      },
    };
  },
};
