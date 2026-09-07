import { supabase, isDemoModeActive, isSupabaseConfigured } from '@/backend/utilities/supabase';
import { Client } from '@/shared/types';
import { mockClients } from '@/backend/store/mockData';

const CLIENT_SESSION_KEY = 'flowdesk_client_session';

export interface ClientAuthResult {
  success: boolean;
  client?: Client;
  error?: string;
  isConfigured?: boolean;
}

export const ClientAuthService = {
  /**
   * Demo Mode: Login a client using mock data (no Supabase required).
   */
  loginDemo: async (email?: string): Promise<ClientAuthResult> => {
    // Defense in depth: demo client login is only permitted in explicitly
    // configured demo environments.
    if (!isDemoModeActive()) {
      return { success: false, error: 'Demo access is not enabled in this environment.' };
    }
    const targetEmail = email || 'eleanor@apexdigital.io';
    // Find matching client from mock data by email, or use first active client
    const matchedClient = mockClients.find(
      (c) => c.email.toLowerCase() === targetEmail.toLowerCase()
    ) || mockClients.find((c) => c.status === 'active') || mockClients[0];

    if (!matchedClient) {
      return {
        success: false,
        error: 'No demo client accounts available.',
        isConfigured: false,
      };
    }

    // Store client session in localStorage and set cookies
    if (typeof window !== 'undefined') {
      localStorage.setItem('flowdesk_demo_active', 'true');
      localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(matchedClient));
    }
    if (typeof document !== 'undefined') {
      document.cookie = 'flowdesk_demo_active=true; path=/; max-age=86400; SameSite=Lax';
      document.cookie = 'flowdesk_client_demo=true; path=/; max-age=86400; SameSite=Lax';
    }

    return { success: true, client: matchedClient, isConfigured: true };
  },

  /**
   * Logs in a client using Supabase Auth (email + password required).
   * Production auth MUST go through Supabase — no email-only bypass.
   */
  login: async (email: string, password: string): Promise<ClientAuthResult> => {
    // Demo mode: use mock data
    if (isDemoModeActive()) {
      return ClientAuthService.loginDemo(email);
    }

    try {
      if (!password) {
        return {
          success: false,
          error: 'Password is required for client authentication.',
          isConfigured: false,
        };
      }

      // Supabase Auth is the ONLY authentication path
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message, isConfigured: false };
      }

      if (data.user) {
        const client = await ClientAuthService.resolveClientByUserIdOrEmail(data.user.id, data.user.email);
        if (!client) {
          return {
            success: false,
            error: 'Your account is not configured as a client account. Please contact your service provider.',
            isConfigured: false,
          };
        }

        if (client.status === 'pending_deletion') {
          await ClientAuthService.logout();
          return {
            success: false,
            error: 'This client account is scheduled for deletion and is currently disabled. Please contact your freelancer to restore access.',
            isConfigured: false,
          };
        }

        return { success: true, client, isConfigured: true };
      }

      return { success: false, error: 'Authentication failed.', isConfigured: false };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'An unexpected authentication error occurred.',
        isConfigured: false,
      };
    }
  },

  /**
   * Verify portal token — requires an authenticated Supabase session first.
   * The token is used to resolve the client record, NOT to authenticate.
   */
  verifyPortalToken: async (tokenOrKey: string): Promise<ClientAuthResult> => {
    try {
      // Step 1: Require authenticated Supabase session
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return {
          success: false,
          error: 'Authentication required. Please log in to access the client portal.',
          isConfigured: false,
        };
      }

      // Step 2: Resolve client from authenticated user
      const client = await ClientAuthService.resolveClientByUserIdOrEmail(user.id, user.email);
      if (!client) {
        return {
          success: false,
          error: 'Your account is not configured as a client account.',
          isConfigured: false,
        };
      }

      if (client.status === 'pending_deletion') {
        return {
          success: false,
          error: 'This client account is scheduled for deletion and is currently disabled.',
          isConfigured: false,
        };
      }

      // Step 3: Verify the token matches this client (optional verification, not auth)
      if (tokenOrKey && tokenOrKey.trim()) {
        const cleanToken = tokenOrKey.trim();
        if (client.portalToken !== cleanToken && client.id !== cleanToken) {
          console.warn('Portal token mismatch — access granted via Supabase auth.');
        }
      }

      return { success: true, client, isConfigured: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Portal verification failed.', isConfigured: false };
    }
  },

  /**
   * Resolves the authenticated client from current Supabase session
   */
  getAuthenticatedClient: async (): Promise<Client | null> => {
    // Demo mode: read from localStorage
    if (isDemoModeActive()) {
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(CLIENT_SESSION_KEY) : null;
        if (stored) {
          const parsed = JSON.parse(stored) as Client;
          if (parsed.status === 'pending_deletion') return null;
          return parsed;
        }
        return mockClients[0];
      } catch {
        return mockClients[0];
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const client = await ClientAuthService.resolveClientByUserIdOrEmail(user.id, user.email);
      if (client && client.status === 'pending_deletion') {
        return null;
      }
      return client;
    } catch (err) {
      console.warn('Error resolving authenticated client session:', err);
      return null;
    }
  },

  resolveClientByUserIdOrEmail: async (userId: string, email?: string): Promise<Client | null> => {
    try {
      // 1. Identity is bound to the authenticated Supabase user.
      const { data } = await supabase.from('clients').select('*').eq('user_id', userId).maybeSingle();

      // 2. First-login fallback: bind by email ONLY when the email maps to
      //    exactly one client record. If the same email exists in multiple
      //    workspaces, the match is ambiguous and MUST NOT grant access to any
      //    of them — the freelancer must explicitly associate the account.
      if (!data && email) {
        const { data: matches, error: matchErr } = await supabase
          .from('clients')
          .select('*')
          .eq('email', email);

        if (!matchErr && matches && matches.length === 1) {
          const match = matches[0];
          // Bind the authenticated user to this client record so future
          // lookups are user-scoped, not email-scoped.
          if (match.user_id !== userId) {
            await supabase.from('clients').update({ user_id: userId }).eq('id', match.id);
          }
          return {
            id: match.id,
            userId: match.user_id || userId,
            portalToken: match.portal_token,
            name: match.name,
            company: match.company,
            email: match.email,
            phone: match.phone || '',
            avatarUrl: match.avatar_url || '',
            status: match.status || 'active',
            healthBadge: match.health_badge || 'healthy',
            totalBilled: Number(match.total_billed) || 0,
            activeProjectsCount: match.active_projects_count || 0,
            country: match.country || 'India',
            currency: match.currency || 'USD',
            createdAt: match.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            deletedAt: match.deleted_at?.split('T')[0] || undefined,
          };
        }
        // Ambiguous (multiple workspaces share this email) or none: no access.
        return null;
      }

      if (data) {
        return {
          id: data.id,
          userId: data.user_id,
          portalToken: data.portal_token,
          name: data.name,
          company: data.company,
          email: data.email,
          phone: data.phone || '',
          avatarUrl: data.avatar_url || '',
          status: data.status || 'active',
          healthBadge: data.health_badge || 'healthy',
          totalBilled: Number(data.total_billed) || 0,
          activeProjectsCount: data.active_projects_count || 0,
          country: data.country || 'India',
          currency: data.currency || 'USD',
          createdAt: data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          deletedAt: data.deleted_at?.split('T')[0] || undefined,
        };
      }

      return null;
    } catch (err) {
      console.warn('Error resolving client record:', err);
      return null;
    }
  },

  /**
   * Client deletes their own account (initiates 30-day recovery period)
   */
  deleteOwnAccount: async (clientId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { AccountDeletionService } = await import('@/backend/auth/account-deletion-service');
      const res = await AccountDeletionService.deleteClientAccount(clientId);
      if (res.success) {
        await ClientAuthService.logout();
      }
      return res;
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to initiate account deletion.' };
    }
  },

  logout: async (): Promise<void> => {
    // Clear localStorage session and demo cookies
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CLIENT_SESSION_KEY);
    }
    if (typeof document !== 'undefined') {
      document.cookie = 'flowdesk_client_demo=; path=/; max-age=0; SameSite=Lax';
    }

    if (!isSupabaseConfigured) {
      return;
    }

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Error during client logout:', err);
    }
  },
};
