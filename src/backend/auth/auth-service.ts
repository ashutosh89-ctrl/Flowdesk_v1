import { supabase, isSupabaseConfigured, isProductionMode, isDemoMode, isDemoModeActive } from '@/backend/utilities/supabase';
import { ProfileService } from '@/backend/auth/profile-service';
import { UserSettingsService } from '@/backend/auth/user-settings-service';
import { SessionService } from '@/backend/auth/session-service';
import { clearWorkspaceCache } from '@/backend/utilities/workspace';

export interface AuthResponse {
  user: any | null;
  error: string | null;
  message?: string;
}

function isNetworkOrConfigError(err: any): boolean {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : err.message || '';
  return (
    msg.includes('Failed to fetch') ||
    msg.includes('fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('network') ||
    msg.includes('Invalid URL') ||
    msg.includes('URL') ||
    msg.includes('placeholder-project')
  );
}

export const AuthService = {
  /**
   * Demo Mode Signup Fallback
   */
  async signUpDemo(email: string, fullName: string, businessName: string): Promise<AuthResponse> {
    const mockUserId = `usr-${Date.now()}`;
    const { user } = SessionService.setLocalSession({
      id: mockUserId,
      email,
      user_metadata: { full_name: fullName, business_name: businessName },
    });

    await ProfileService.upsertProfile(mockUserId, {
      id: mockUserId,
      name: fullName,
      companyName: businessName,
      email,
      onboardingCompleted: false,
    });

    return { user, error: null, message: 'Account created successfully.' };
  },

  /**
   * Email Sign Up
   */
  async signUp(email: string, password: string, fullName: string, businessName: string): Promise<AuthResponse> {
    // Explicit auth mode: only use demo if explicitly in demo mode
    if (isDemoModeActive()) {
      return this.signUpDemo(email, fullName, businessName);
    }

    // Production mode requires Supabase
    if (!isSupabaseConfigured) {
      return { user: null, error: 'Supabase is not configured. Please set up your database connection.' };
    }

    try {
      const appUrl = process.env.APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
      const redirectUri = `${appUrl}/auth/callback`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUri,
          data: {
            full_name: fullName,
            business_name: businessName,
          },
        },
      });

      if (error) {
        // Production mode: NEVER fall back to demo. Show the real error.
        return { user: null, error: error.message };
      }

      if (data.user) {
        // Upsert profile in Supabase
        await ProfileService.upsertProfile(data.user.id, {
          id: data.user.id,
          name: fullName,
          companyName: businessName,
          email,
          onboardingCompleted: false,
        });

        await UserSettingsService.saveUserSettings(data.user.id, {
          currency: 'USD',
          tax_name: 'Sales Tax',
          default_tax_rate: 10,
        });

        // Set local session copy for seamless state persistence
        SessionService.setLocalSession(data.user);
      }

      const returnedUser = data.user || (await SessionService.getSession()).user;
      return {
        user: returnedUser,
        error: null,
        message: data.session ? 'Account created successfully.' : 'Verification code sent to your email.',
      };
    } catch (err: any) {
      // Production mode: NEVER fall back to demo. Show the real error.
      return { user: null, error: err.message || 'An unexpected error occurred during signup.' };
    }
  },

  /**
   * Demo Mode Signin Fallback
   */
  async signInDemo(email?: string): Promise<AuthResponse> {
    // Defense in depth: demo sign-in is only permitted in explicitly configured
    // demo environments. A production visitor cannot activate demo mode manually.
    if (!isDemoModeActive()) {
      return { user: null, error: 'Demo access is not enabled in this environment.' };
    }
    const targetEmail = email || 'alex@riveradesign.co';
    const isAlex = targetEmail.toLowerCase().includes('alex') || targetEmail.toLowerCase().includes('rivera');
    const mockUserId = `usr-demo-alex`;
    const displayName = isAlex ? 'Alex Rivera' : (targetEmail.split('@')[0] || 'Demo User');
    const businessName = isAlex ? 'Rivera Design Studio' : 'FlowDesk Studio';

    if (typeof window !== 'undefined') {
      localStorage.setItem('flowdesk_demo_active', 'true');
    }
    if (typeof document !== 'undefined') {
      document.cookie = 'flowdesk_demo_active=true; path=/; max-age=86400; SameSite=Lax';
    }

    const { user } = SessionService.setLocalSession({
      id: mockUserId,
      email: targetEmail,
      user_metadata: { full_name: displayName, business_name: businessName },
    });

    await ProfileService.upsertProfile(mockUserId, {
      id: mockUserId,
      name: displayName,
      companyName: businessName,
      email: targetEmail,
      onboardingCompleted: true,
    });

    await UserSettingsService.saveUserSettings(mockUserId, {
      currency: 'USD',
      tax_name: 'Sales Tax',
      default_tax_rate: 10,
    });

    return { user, error: null };
  },

  /**
   * Email Sign In
   */
  async signIn(email: string, password: string): Promise<AuthResponse> {
    // Explicit auth mode: only use demo if explicitly in demo mode
    if (isDemoModeActive()) {
      return this.signInDemo(email);
    }

    // Production mode requires Supabase
    if (!isSupabaseConfigured) {
      return { user: null, error: 'Supabase is not configured. Please set up your database connection.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Production mode: NEVER fall back to demo. Show the real error.
        return { user: null, error: error.message };
      }

      if (data.user) {
        SessionService.setLocalSession(data.user);
      }

      return { user: data.user, error: null };
    } catch (err: any) {
      // Production mode: NEVER fall back to demo. Show the real error.
      return { user: null, error: err.message || 'Failed to sign in.' };
    }
  },

  async signInWithGoogleDemo(): Promise<{ error: string | null }> {
    if (!isDemoModeActive()) {
      return { error: 'Google OAuth requires Supabase configuration.' };
    }
    const mockUserId = `usr-google-${Date.now()}`;
    SessionService.setLocalSession({
      id: mockUserId,
      email: 'user.google@example.com',
      user_metadata: { full_name: 'Google User', avatar_url: '' },
    });

    await ProfileService.upsertProfile(mockUserId, {
      id: mockUserId,
      name: 'Google User',
      companyName: 'My Workspace',
      email: 'user.google@example.com',
      onboardingCompleted: false,
    });

    return { error: null };
  },

  /**
   * Demo Mode GitHub Signin Fallback
   */
  async signInWithGitHubDemo(): Promise<{ error: string | null }> {
    if (!isDemoModeActive()) {
      return { error: 'GitHub OAuth requires Supabase configuration.' };
    }
    const mockUserId = `usr-github-${Date.now()}`;
    SessionService.setLocalSession({
      id: mockUserId,
      email: 'user.github@example.com',
      user_metadata: { full_name: 'GitHub User', avatar_url: '' },
    });

    await ProfileService.upsertProfile(mockUserId, {
      id: mockUserId,
      name: 'GitHub User',
      companyName: 'My Workspace',
      email: 'user.github@example.com',
      onboardingCompleted: false,
    });

    return { error: null };
  },

  /**
   * Google OAuth Login using Supabase
   */
  async signInWithGoogle(): Promise<{ error: string | null }> {
    try {
      const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${originUrl}/auth/callback`,
        },
      });

      if (error) {
        return { error: error.message };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Google OAuth failed to initialize.' };
    }
  },

  /**
   * GitHub OAuth Login using Supabase
   */
  async signInWithGitHub(): Promise<{ error: string | null }> {
    try {
      const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${originUrl}/auth/callback`,
        },
      });

      if (error) {
        return { error: error.message };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'GitHub OAuth failed to initialize.' };
    }
  },

  /**
   * Request Password Reset Email
   */
  async forgotPassword(email: string): Promise<AuthResponse> {
    if (isDemoModeActive()) {
      return { user: null, error: null, message: 'Reset password code dispatched to your email.' };
    }

    if (!isSupabaseConfigured) {
      return { user: null, error: 'Supabase is not configured. Password reset unavailable.' };
    }

    try {
      const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${originUrl}/auth/reset-password`,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      return { user: null, error: null, message: 'Password reset link sent to your email.' };
    } catch (err: any) {
      return { user: null, error: err.message || 'Failed to send password reset email.' };
    }
  },

  /**
   * Reset Password
   */
  async resetPassword(newPassword: string): Promise<AuthResponse> {
    if (isDemoModeActive()) {
      return { user: null, error: null, message: 'Password successfully updated.' };
    }

    if (!isSupabaseConfigured) {
      return { user: null, error: 'Supabase is not configured. Password reset unavailable.' };
    }

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      return { user: data.user, error: null, message: 'Password updated successfully.' };
    } catch (err: any) {
      return { user: null, error: err.message || 'Failed to update password.' };
    }
  },

  /**
   * Verify Email OTP
   */
  async verifyOtp(email: string, token: string): Promise<AuthResponse> {
    const { user: currentLocalUser } = await SessionService.getSession();

    if (isDemoModeActive()) {
      const activeUser = currentLocalUser || {
        id: `usr-${Date.now()}`,
        email: email || 'user@example.com',
        user_metadata: { full_name: 'User', business_name: 'My Workspace' },
      };
      const { user } = SessionService.setLocalSession(activeUser);
      return { user, error: null, message: 'Email address verified.' };
    }

    if (!isSupabaseConfigured) {
      return { user: null, error: 'Supabase is not configured. Email verification unavailable.' };
    }

    if (currentLocalUser) {
      return { user: currentLocalUser, error: null, message: 'Email address verified.' };
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (data.user) {
        SessionService.setLocalSession(data.user);
      }

      return { user: data.user, error: null, message: 'Email verified successfully.' };
    } catch (err: any) {
      return { user: null, error: err.message || 'Invalid verification token.' };
    }
  },

  /**
   * Sign Out
   */
  async signOut(): Promise<{ error: string | null }> {
    SessionService.clearLocalSession();
    clearWorkspaceCache();

    if (!isSupabaseConfigured) {
      return { error: null };
    }

    try {
      await supabase.auth.signOut();
      return { error: null };
    } catch (err: any) {
      return { error: null };
    }
  },
};

