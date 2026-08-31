import { supabase } from '../lib/supabase';

export interface WorkspaceRecord {
  id: string;
  owner_id: string;
  name: string;
  logo_url?: string;
  created_at?: string;
}

let activeWorkspaceIdCache: string | null = null;

export const WorkspaceService = {
  /**
   * Get active workspace ID for current user
   */
  async getActiveWorkspaceId(): Promise<string | null> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      // 1. Try fetching from workspaces by owner_id
      const { data, error } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (data && data.length > 0) {
        activeWorkspaceIdCache = data[0].id;
        return data[0].id;
      }

      // 2. If no workspace exists for user, create one
      const { data: newWs, error: createError } = await supabase
        .from('workspaces')
        .insert({
          owner_id: user.id,
          name: 'My Workspace',
        })
        .select('id')
        .single();

      if (newWs) {
        activeWorkspaceIdCache = newWs.id;
        return newWs.id;
      }

      return null;
    } catch (err: any) {
      console.warn('Notice resolving active workspace ID:', err?.message);
      return activeWorkspaceIdCache;
    }
  },

  /**
   * Clear cache on signout
   */
  clearCache() {
    activeWorkspaceIdCache = null;
  },
};
