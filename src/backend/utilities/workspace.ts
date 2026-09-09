import { supabase, isDemoModeActive } from '@/backend/utilities/supabase';
import { AuthError, NotFoundError } from './errors';

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  logoUrl?: string;
  signatureUrl?: string;
  createdAt: string;
}

let workspaceCache: { userId: string; workspace: Workspace } | null = null;

// Mock workspace for demo mode
const DEMO_WORKSPACE: Workspace = {
  id: 'ws-demo-001',
  ownerId: 'usr-demo',
  name: 'My Workspace',
  logoUrl: '',
  signatureUrl: '',
  createdAt: '2026-01-01T00:00:00Z',
};

export async function getCurrentWorkspace(): Promise<Workspace | null> {
  // Demo mode: return mock workspace immediately without querying Supabase
  if (isDemoModeActive()) {
    try {
      const { SessionService } = await import('@/backend/auth/session-service');
      const { session } = await SessionService.getSession();
      const userId = session?.user?.id || 'usr-demo';
      return { ...DEMO_WORKSPACE, ownerId: userId };
    } catch {
      return DEMO_WORKSPACE;
    }
  }

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
        logoUrl: data[0].logo_url || '',
        signatureUrl: data[0].signature_url || '',
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
        logoUrl: newWs.logo_url || '',
        signatureUrl: newWs.signature_url || '',
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

export async function updateWorkspaceBranding(
  workspaceId: string,
  branding: { logoUrl?: string; signatureUrl?: string; name?: string }
): Promise<boolean> {
  if (isDemoModeActive()) {
    if (branding.logoUrl !== undefined) DEMO_WORKSPACE.logoUrl = branding.logoUrl;
    if (branding.signatureUrl !== undefined) DEMO_WORKSPACE.signatureUrl = branding.signatureUrl;
    if (branding.name !== undefined) DEMO_WORKSPACE.name = branding.name;
    return true;
  }

  try {
    const payload: any = { updated_at: new Date().toISOString() };
    if (branding.logoUrl !== undefined) payload.logo_url = branding.logoUrl;
    if (branding.signatureUrl !== undefined) payload.signature_url = branding.signatureUrl;
    if (branding.name !== undefined) payload.name = branding.name;

    const { error } = await supabase
      .from('workspaces')
      .update(payload)
      .eq('id', workspaceId);

    if (!error) {
      clearWorkspaceCache();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Error updating workspace branding:', err);
    return false;
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
