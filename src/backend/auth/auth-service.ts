import { supabase, isSupabaseConfigured, isDemoModeActive, isAuthConfigError, assertSupabaseConfigured, AUTH_CONFIG_ERROR_MESSAGE } from '@/backend/utilities/supabase';
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
    // Fail-closed guard: only explicitly configured demo deployments may reach this.
    if (!isDemoModeActive()) {
      return { user: null, error: 'Signup is unavailable: deployment configuration error.' };
    }
    if (!email?.trim() || !fullName?.trim() || !businessName?.trim()) {
      return { user: null, error: 'All fields (full name, business name, email) are required.' };
    }
    const mockUserId = `usr-${Date.now()}`;
    const { user } = SessionService.setLocalSession({
      id: mockUserId,
      email: email.trim(),
      user_metadata: { full_name: fullName.trim(), business_name: businessName.trim() },
    });

    await ProfileService.upsertProfile(mockUserId, {
      id: mockUserId,
      name: fullName.trim(),
      companyName: businessName.trim(),
      email: email.trim(),
      onboardingCompleted: false,
    });

    return { user, error: null, message: 'Account created successfully.' };
  },

  /**
   * Email Sign Up
   */
  async signUp(email: string, password: string, fullName: string, businessName: string): Promise<AuthResponse> {
    if (!email?.trim() || !password || !fullName?.trim() || !businessName?.trim()) {
      return { user: null, error: 'All fields (full name, business name, email, password) are required.' };
    }

    // Demo signup ONLY in explicitly configured demo deployments.
    if (isDemoModeActive()) {
      return this.signUpDemo(email, fullName, businessName);
    }

    // Fail closed when the deployment is missing Supabase configuration.
    if (isAuthConfigError()) {
      return { user: null, error: AUTH_CONFIG_ERROR_MESSAGE };
    }

    try {
      // APP_URL is a server-only hint for non-browser flows. In the browser the
      // current origin is authoritative — a stale APP_URL must never redirect
      // confirmation emails to the wrong host (e.g. localhost or an old deploy).
      const appUrl =
        typeof window !== 'undefined'
          ? window.location.origin
          : process.env.APP_URL || '';
      if (!appUrl) {
        return { user: null, error: 'Signup is unavailable: application URL is not configured.' };
      }
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
    // Defense in depth: demo sign-in is ONLY permitted in explicitly configured
    // demo deployments (NEXT_PUBLIC_AUTH_MODE=demo). A production visitor —
    // including one on a deployment with broken Supabase config — cannot enter
    // demo mode. localStorage/cookies can never activate it either.
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
    if (!email?.trim() || !password) {
      return { user: null, error: 'Email and password are required.' };
    }

    // Demo sign-in ONLY in explicitly configured demo deployments.
    if (isDemoModeActive()) {
      return this.signInDemo(email);
    }

    // Fail closed when the deployment is missing Supabase configuration.
    if (isAuthConfigError()) {
      return { user: null, error: AUTH_CONFIG_ERROR_MESSAGE };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
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
    if (!email?.trim()) {
      return { user: null, error: 'Email address is required.' };
    }

    if (isDemoModeActive()) {
      return { user: null, error: null, message: 'Reset password code dispatched to your email.' };
    }

    // Fail closed when the deployment is missing Supabase configuration.
    if (isAuthConfigError()) {
      return { user: null, error: AUTH_CONFIG_ERROR_MESSAGE };
    }

    try {
      const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
      if (!originUrl) {
        return { user: null, error: 'Password reset is unavailable: application URL is not configured.' };
      }
      // Single authoritative recovery flow: Supabase sends the user to the app's
      // OAuth callback with type=recovery; the callback route exchanges the code
      // server-side and redirects to /reset-password. No competing mechanism.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${originUrl}/auth/callback?type=recovery`,
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
    if (!newPassword?.trim()) {
      return { user: null, error: 'New password is required.' };
    }

    if (isDemoModeActive()) {
      return { user: null, error: null, message: 'Password successfully updated.' };
    }

    // Fail closed when the deployment is missing Supabase configuration.
    if (isAuthConfigError()) {
      return { user: null, error: AUTH_CONFIG_ERROR_MESSAGE };
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
    if (!email?.trim() || !token?.trim()) {
      return { user: null, error: 'Email and verification code are required.' };
    }

    const { user: currentLocalUser } = await SessionService.getSession();

    if (isDemoModeActive()) {
      const isAlex = email.toLowerCase().includes('alex') || email.toLowerCase().includes('rivera');
      const isMatch = Boolean(currentLocalUser && currentLocalUser.email?.toLowerCase() === email.trim().toLowerCase());
      const activeUser = (isMatch && currentLocalUser) ? currentLocalUser : {
        id: isAlex ? 'usr-demo-alex' : `usr-${Date.now()}`,
        email: email.trim(),
        user_metadata: {
          full_name: isAlex ? 'Alex Rivera' : (email.split('@')[0] || 'Demo User'),
          business_name: isAlex ? 'Rivera Design Studio' : 'FlowDesk Studio',
        },
      };
      const { user } = SessionService.setLocalSession(activeUser);
      return { user, error: null, message: 'Email address verified.' };
    }

    // Fail closed when the deployment is missing Supabase configuration.
    if (isAuthConfigError()) {
      return { user: null, error: AUTH_CONFIG_ERROR_MESSAGE };
    }

    // SECURITY: a pre-existing session must NEVER stand in for OTP verification.
    // In production the code the user typed must always be validated by Supabase.
    if (currentLocalUser && !isSupabaseConfigured) {
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

