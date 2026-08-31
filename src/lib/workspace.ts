import { supabase } from './supabase';
import { AuthError, NotFoundError } from './errors';

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  logoUrl?: string;
  createdAt: string;
}

let workspaceCache: { userId: string; workspace: Workspace } | null = null;

export async function getCurrentWorkspace(): Promise<Workspace | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    if (workspaceCache && workspaceCache.userId === user.id) {
      return workspaceCache.workspace;
    }

    // Query user's owned workspace from database
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1);

    if (data && data.length > 0) {
      const ws: Workspace = {
        id: data[0].id,
        ownerId: data[0].owner_id,
        name: data[0].name,
        logoUrl: data[0].logo_url,
        createdAt: data[0].created_at,
      };
      workspaceCache = { userId: user.id, workspace: ws };
      return ws;
    }

    // Auto-initialize workspace if missing for authenticated user
    const { data: newWs, error: createError } = await supabase
      .from('workspaces')
      .insert({
        owner_id: user.id,
        name: 'My Workspace',
      })
      .select()
      .single();

    if (newWs) {
      const ws: Workspace = {
        id: newWs.id,
        ownerId: newWs.owner_id,
        name: newWs.name,
        logoUrl: newWs.logo_url,
        createdAt: newWs.created_at,
      };
      workspaceCache = { userId: user.id, workspace: ws };
      return ws;
    }

    return null;
  } catch (err) {
    console.warn('Workspace resolution error:', err);
    return workspaceCache ? workspaceCache.workspace : null;
  }
}

export async function requireWorkspace(): Promise<Workspace> {
  const ws = await getCurrentWorkspace();
  if (!ws) {
    throw new AuthError('Workspace access required. Please sign in or complete onboarding.');
  }
  return ws;
}

export async function getWorkspaceId(): Promise<string> {
  const ws = await requireWorkspace();
  return ws.id;
}

export function clearWorkspaceCache() {
  workspaceCache = null;
}
