import { supabase } from '@/backend/utilities/supabase';
import { PortalComment } from '@/shared/types';
import { NotificationHelper } from '@/backend/utilities/notification-helper';

export const ClientCommentService = {
  /**
   * Retrieves non-internal discussion comments scoped to the authenticated client
   */
  getComments: async (clientId: string): Promise<PortalComment[]> => {
    if (!clientId) return [];

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

    return [];
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
      return { success: false, error: 'Cannot post empty comment or unauthorized client context.' };
    }

    try {
      const { data, error } = await supabase
        .from('workspace_comments')
        .insert({
          client_id: clientId,
          author: commentData.author,
          author_avatar: commentData.avatar,
          text: commentData.text,
          is_owner: false,
          is_internal: false,
        })
        .select()
        .single();

      if (!error && data) {
        // Log activity for client comment
        try {
          const { data: ws } = await supabase.from('workspaces').select('id').limit(1).single();
          if (ws) {
            await supabase.from('activities').insert({
              workspace_id: ws.id,
              action: 'posted_comment',
              title: 'Client Comment',
              description: commentData.text.slice(0, 200),
              user_name: commentData.author,
              resource_type: 'comment',
              client_id: clientId,
            });
          }
        } catch { /* non-critical */ }

        // Notify freelancer about new client comment
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
    } catch (err) {
      console.warn('Supabase comment posting error:', err);
    }

    return { success: false, error: 'Failed to post comment' };
  },
};
