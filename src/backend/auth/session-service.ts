import { supabase, isSupabaseConfigured, isDemoModeActive, isAuthConfigError } from '@/backend/utilities/supabase';
import { Session, User } from '@supabase/supabase-js';

const LOCAL_SESSION_KEY = 'flowdesk_auth_session';
const DEMO_SESSION_KEY = 'flowdesk_demo_active';

export const SessionService = {
  /**
   * Get current auth session.
   *
   * Demo mode (explicitly configured via NEXT_PUBLIC_AUTH_MODE=demo or missing
   * Supabase credentials) reads the local demo session from localStorage.
   *
   * Production mode relies on the Supabase session ONLY. Browser state and
   * localStorage are never accepted as identity — Supabase failures fail closed
   * (return null) rather than fabricating or falling back to a local session.
   */
  async getSession(): Promise<{ session: Session | null; user: User | null }> {
    // Explicitly configured demo environment: local demo session is allowed.
    if (isDemoModeActive()) {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_SESSION_KEY) : null;
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.user) {
            return { session: parsed.session || null, user: parsed.user || null };
          }
        } catch {
          // ignore parse errors
        }
      }
      // No local demo session yet — fabricate the default demo identity ONLY in demo mode.
      if (typeof window !== 'undefined') {
        const mockUserId = 'usr-demo-alex';
        const mockUser: User = {
          id: mockUserId,
          app_metadata: {},
          user_metadata: { full_name: 'Alex Rivera', business_name: 'Rivera Design Studio' },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
          email: 'alex@riveradesign.co',
        } as User;
        const mockSession: Session = {
          access_token: 'mock-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          user: mockUser,
        };
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ session: mockSession, user: mockUser }));
        return { session: mockSession, user: mockUser };
      }
      return { session: null, user: null };
    }

    // Production: Supabase is the ONLY source of truth. Fail closed on errors
    // AND on missing configuration (never fabricate a session).
    if (!isSupabaseConfigured) {
      return { session: null, user: null };
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('Notice fetching session from Supabase:', error.message);
        return { session: null, user: null };
      }
      return { session: data.session, user: data.session?.user || null };
    } catch (err: any) {
      console.warn('Session retrieval exception:', err?.message);
      return { session: null, user: null };
    }
  },

  /**
   * Get the current user with SERVER-SIDE verification (Supabase Auth /user
   * endpoint). Unlike getSession(), this validates the JWT against Supabase,
   * so stale or forged local state can never pass as identity.
   *
   * Used where authentication authority is required (AuthProvider init,
   * post-login gate). Fails closed: returns null user on any error.
   */
  async getVerifiedUser(): Promise<User | null> {
    // Explicitly configured demo environment: local demo session is allowed.
    if (isDemoModeActive()) {
      const { user } = await this.getSession();
      return user;
    }

    if (!isSupabaseConfigured) {
      return null;
    }

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.warn('Notice fetching verified user from Supabase:', error.message);
        return null;
      }
      return data.user || null;
    } catch (err: any) {
      console.warn('Verified user retrieval exception:', err?.message);
      return null;
    }
  },

  /**
   * Refresh session tokens
   */
  async refreshSession(): Promise<Session | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.warn('Token refresh notice:', error.message);
        return null;
      }
      return data.session;
    } catch (err: any) {
      console.warn('Token refresh exception:', err?.message);
      return null;
    }
  },

  /**
   * Set local mock session and mark demo mode as active.
   */
  setLocalSession(user: Partial<User>) {
    const mockUser: User = {
      id: user.id || `usr-${Date.now()}`,
      app_metadata: {},
      user_metadata: user.user_metadata || {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: user.email || 'user@flowdesk.co',
    } as User;

    const mockSession: Session = {
      access_token: 'mock-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
      user: mockUser,
    };

    // Store the session
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ session: mockSession, user: mockUser }));
      // Mark demo mode as active so getSession() knows to read from localStorage
      localStorage.setItem(DEMO_SESSION_KEY, 'true');
    }

    if (typeof document !== 'undefined') {
      document.cookie = 'flowdesk_demo_active=true; path=/; max-age=86400; SameSite=Lax';
    }

    return { session: mockSession, user: mockUser };
  },

  /**
   * Clear local session and all FlowDeskStore data
   */
  clearLocalSession() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      localStorage.removeItem(DEMO_SESSION_KEY);
      // Clear all FlowDeskStore data to prevent stale data from appearing
      const flowdeskKeys = [
        'flowdesk_clients',
        'flowdesk_projects',
        'flowdesk_deliverables',
        'flowdesk_documents',
        'flowdesk_invoices',
        'flowdesk_activities',
        'flowdesk_comments',
        'flowdesk_portals',
        'flowdesk_notifications',
        'flowdesk_user_profile',
        'flowdesk_pinned_items',
        'flowdesk_recent_items',
        'flowdesk_widget_config',
        'flowdesk_recent_searches',
      ];
      flowdeskKeys.forEach((key) => localStorage.removeItem(key));
    }

    if (typeof document !== 'undefined') {
      document.cookie = 'flowdesk_demo_active=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'flowdesk_client_demo=; path=/; max-age=0; SameSite=Lax';
    }
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    if (!isSupabaseConfigured) {
      return { unsubscribe: () => {} };
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return authListener.subscription;
  },
};
