import { supabase, isDemoModeActive } from './supabase';
import { ClientAuthService } from '@/backend/client/client-auth-service';

/**
 * Server-side identity resolution for API routes.
 *
 * Identity is ALWAYS derived from the authenticated Supabase session — never
 * from request bodies, query parameters, cookies, or localStorage.
 *
 * Returns:
 *  - userId: the authenticated Supabase user id (null if unauthenticated)
 *  - clientId: the client record bound to the user (if the user is a client)
 *  - workspaceId: the workspace owned by the user (if the user is a freelancer)
 */
export interface ApiCallerIdentity {
  userId: string | null;
  clientId: string | null;
  workspaceId: string | null;
  isDemo: boolean;
}

export async function resolveApiCaller(): Promise<ApiCallerIdentity> {
  const isDemo = isDemoModeActive();

  if (isDemo) {
    // Explicitly configured demo environment: resolve from the demo client
    // session if present; otherwise anonymous.
    try {
      const { ClientAuthService } = await import('@/backend/client/client-auth-service');
      const client = await ClientAuthService.getAuthenticatedClient();
      if (client) {
        return { userId: null, clientId: client.id, workspaceId: null, isDemo: true };
      }
    } catch {
      // fall through to anonymous demo caller
    }
    return { userId: null, clientId: null, workspaceId: null, isDemo: true };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { userId: null, clientId: null, workspaceId: null, isDemo: false };
    }

    // Resolve client identity (a user may be a client in a workspace)
    let clientId: string | null = null;
    try {
      const client = await ClientAuthService.resolveClientByUserIdOrEmail(user.id, user.email || undefined);
      clientId = client?.id || null;
    } catch {
      clientId = null;
    }

    // Resolve freelancer workspace identity
    let workspaceId: string | null = null;
    try {
      const { data } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      workspaceId = data?.id || null;
    } catch {
      workspaceId = null;
    }

    return { userId: user.id, clientId, workspaceId, isDemo: false };
  } catch (err) {
    console.warn('resolveApiCaller error:', err);
    return { userId: null, clientId: null, workspaceId: null, isDemo: false };
  }
}

/**
 * Requires an authenticated caller. Returns the identity or throws/returns null.
 */
export async function requireApiCaller(): Promise<ApiCallerIdentity | null> {
  const caller = await resolveApiCaller();
  if (!caller.isDemo && !caller.userId) return null;
  return caller;
}