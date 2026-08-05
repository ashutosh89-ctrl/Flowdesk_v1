import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

const LOCAL_SESSION_KEY = 'flowdesk_auth_session';

export const SessionService = {
  /**
   * Get current Supabase auth session
   */
  async getSession(): Promise<{ session: Session | null; user: User | null }> {
    if (!isSupabaseConfigured) {
      const stored = localStorage.getItem(LOCAL_SESSION_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return { session: parsed.session || null, user: parsed.user || null };
        } catch {
          // ignore
        }
      }
      return { session: null, user: null };
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('Notice fetching session from Supabase (using local fallback):', error.message);
        return { session: null, user: null };
      }
      return { session: data.session, user: data.session?.user || null };
    } catch (err: any) {
      console.warn('Session retrieval exception (using local fallback):', err?.message);
      return { session: null, user: null };
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
   * Set local mock session
   */
  setLocalSession(user: Partial<User>) {
    const mockUser: User = {
      id: user.id || `usr-${Date.now()}`,
      app_metadata: {},
      user_metadata: user.user_metadata || {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      email: user.email || 'alex@riveradesign.co',
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
  },

  /**
   * Clear local session
   */
  clearLocalSession() {
    localStorage.removeItem(LOCAL_SESSION_KEY);
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
