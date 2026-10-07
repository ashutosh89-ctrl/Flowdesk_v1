import { isDemoModeActive } from './supabase';
import { createRouteSupabaseClient } from './supabase-server';

/**
 * Server-side identity resolution for API routes.
 *
 * Identity is ALWAYS derived from the authenticated Supabase session via
 * cookie-aware server client — never from request bodies, query parameters,
 * or localStorage.
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
    const supabaseServer = await createRouteSupabaseClient();
    if (!supabaseServer) {
      return { userId: null, clientId: null, workspaceId: null, isDemo: false };
    }

    const { data: { user }, error: userError } = await supabaseServer.auth.getUser();
    if (userError || !user) {
      return { userId: null, clientId: null, workspaceId: null, isDemo: false };
    }

    // Resolve client identity using user-scoped server client (RLS enforced)
    let clientId: string | null = null;
    try {
      const { data: clientData } = await supabaseServer
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      clientId = clientData?.id || null;
    } catch {
      clientId = null;
    }

    // Resolve freelancer workspace identity using user-scoped server client (RLS enforced)
    let workspaceId: string | null = null;
    try {
      const { data: wsData } = await supabaseServer
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      workspaceId = wsData?.id || null;
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