'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { AuthService, AuthResponse } from '@/backend/auth/auth-service';
import { ProfileService } from '@/backend/auth/profile-service';
import { UserSettingsService } from '@/backend/auth/user-settings-service';
import { SessionService } from '@/backend/auth/session-service';
import { FreelancerClientManagementService as ClientService } from '@/backend/freelancer/client-management-service';
import { isDemoModeActive } from '@/backend/utilities/supabase';
import { UserProfile, UserSettings, OnboardingData } from '@/shared/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  userSettings: UserSettings | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  signUp: (email: string, password: string, fullName: string, businessName: string) => Promise<AuthResponse>;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signInDemo: (email?: string) => Promise<AuthResponse>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithGitHub: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<AuthResponse>;
  resetPassword: (newPassword: string) => Promise<AuthResponse>;
  verifyOtp: (email: string, token: string) => Promise<AuthResponse>;
  completeOnboarding: (data: OnboardingData) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadProfileAndSettings = useCallback(async (userId: string, currentUser?: User | null) => {
    try {
      let fetchedProfile = await ProfileService.getProfile(userId);
      if (!fetchedProfile && currentUser) {
        // Do not inject fake names. Use real metadata or email.
        const name = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'User';
        const businessName = currentUser.user_metadata?.business_name || 'My Workspace';

        fetchedProfile = await ProfileService.upsertProfile(userId, {
          id: userId,
          name,
          companyName: businessName,
          email: currentUser.email || '',
          onboardingCompleted: false,
        });
      } else if (fetchedProfile && currentUser?.email && fetchedProfile.email !== currentUser.email) {
        // Email consistency: Supabase auth.users.email is authoritative.
        // If the user confirmed an email change, converge profiles.email on login.
        // Identity (auth.uid) is unchanged — email is never used for authorization.
        try {
          const { supabase: supabaseClient } = await import('@/backend/utilities/supabase');
          await supabaseClient
            .from('profiles')
            .update({ email: currentUser.email, updated_at: new Date().toISOString() })
            .eq('id', userId);
          fetchedProfile = { ...fetchedProfile, email: currentUser.email };
        } catch (syncErr: any) {
          console.warn('Profile email sync notice:', syncErr?.message);
        }
      }
      setProfile(fetchedProfile);

      const settings = await UserSettingsService.getUserSettings(userId);
      setUserSettings(settings);
    } catch (err: any) {
      console.warn('Error loading profile/settings:', err?.message);
    }
  }, []);

  // Restore session on mount — DETERMINISTIC: isLoading resolves only after
  // auth state is actually known (or the resolution attempt definitively failed).
  // SECURITY: no arbitrary timer may terminate initialization — a slow session
  // request must never cause an authenticated user to be rendered as logged out.
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        // 1. Server-verified identity (Supabase /user endpoint). Fails closed:
        //    returns null on missing config or any error — never a fake user.
        const verifiedUser = await SessionService.getVerifiedUser();

        if (!mounted) return;

        if (verifiedUser) {
          // Keep local session state in sync with the verified identity.
          const { session: verifiedSession } = await SessionService.getSession();
          setSession(verifiedSession);
          setUser(verifiedUser);
          await loadProfileAndSettings(verifiedUser.id, verifiedUser);
        } else {
          // No verified user — unauthenticated. Clear any stale state.
          setSession(null);
          setUser(null);
          setProfile(null);
          setUserSettings(null);
        }
      } catch (err: any) {
        console.warn('Notice initializing auth:', err?.message);
        // Fail closed: unresolved/errored initialization means NOT authenticated.
        if (mounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setUserSettings(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    // Listen to Supabase auth state changes for ongoing updates
    const subscription = SessionService.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      if (isDemoModeActive() && !newSession) {
        // Prevent Supabase INITIAL_SESSION(null) from clobbering active demo session
        return;
      }
      setSession(newSession);
      const newUser = newSession?.user || null;
      setUser(newUser);

      if (newUser) {
        await loadProfileAndSettings(newUser.id, newUser);
      } else {
        setProfile(null);
        setUserSettings(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, [loadProfileAndSettings]);

  const refreshProfile = async () => {
    if (user) {
      await loadProfileAndSettings(user.id, user);
    }
  };

  const handleSignUp = async (email: string, password: string, fullName: string, businessName: string) => {
    setIsLoading(true);
    const response = await AuthService.signUp(email, password, fullName, businessName);
    if (response.user) {
      setUser(response.user);
      await loadProfileAndSettings(response.user.id, response.user);
    }
    setIsLoading(false);
    return response;
  };

  const handleSignIn = async (email: string, password: string) => {
    setIsLoading(true);
    const response = await AuthService.signIn(email, password);
    if (response.user) {
      setUser(response.user);
      await loadProfileAndSettings(response.user.id, response.user);
    }
    setIsLoading(false);
    return response;
  };

  const handleSignInDemo = async (email: string = 'alex@riveradesign.co') => {
    setIsLoading(true);
    const response = await AuthService.signInDemo(email);
    if (response.user) {
      setUser(response.user);
      await loadProfileAndSettings(response.user.id, response.user);
    }
    setIsLoading(false);
    return response;
  };

  const handleSignInWithGoogle = async () => {
    setIsLoading(true);
    const res = await AuthService.signInWithGoogle();
    if (!res.error) {
      const { user: currUser } = await SessionService.getSession();
      if (currUser) {
        setUser(currUser);
        await loadProfileAndSettings(currUser.id, currUser);
      }
    }
    setIsLoading(false);
    return res;
  };

  const handleSignInWithGitHub = async () => {
    setIsLoading(true);
    const res = await AuthService.signInWithGitHub();
    if (!res.error) {
      const { user: currUser } = await SessionService.getSession();
      if (currUser) {
        setUser(currUser);
        await loadProfileAndSettings(currUser.id, currUser);
      }
    }
    setIsLoading(false);
    return res;
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('flowdesk_demo_active');
    }
    if (typeof document !== 'undefined') {
      document.cookie = 'flowdesk_demo_active=; path=/; max-age=0; SameSite=Lax';
    }
    // Clear user-specific localStorage cache before signing out
    if (user) {
      UserSettingsService.clearLocalSettings(user.id);
    }
    await AuthService.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserSettings(null);
    setIsLoading(false);
  };

  const handleForgotPassword = async (email: string) => {
    return AuthService.forgotPassword(email);
  };

  const handleResetPassword = async (newPassword: string) => {
    return AuthService.resetPassword(newPassword);
  };

  const handleVerifyOtp = async (email: string, token: string) => {
    const response = await AuthService.verifyOtp(email, token);
    if (response.user) {
      setUser(response.user);
      await loadProfileAndSettings(response.user.id, response.user);
    }
    return response;
  };

  const handleCompleteOnboarding = async (data: OnboardingData): Promise<boolean> => {
    if (!user) return false;
    try {
      setIsLoading(true);

      const updatedProf = await ProfileService.saveOnboardingData(user.id, data);
      setProfile(updatedProf);

      const updatedSettings = await UserSettingsService.saveUserSettings(user.id, {
        currency: data.currency,
        tax_name: data.taxName,
        default_tax_rate: data.taxRate,
      });
      setUserSettings(updatedSettings);

      if (data.clientName || data.clientCompany) {
        await ClientService.createClient({
          name: data.clientName || 'Lead Executive',
          company: data.clientCompany || data.clientName || 'Apex Digital Labs',
          email: data.clientEmail || 'contact@apexdigital.com',
          status: 'active',
          country: data.country || 'United States',
          currency: data.currency || 'USD',
          notes: 'First client created during onboarding.',
          activeProjectsCount: 1,
        });
      }

      setIsLoading(false);
      return true;
    } catch (err: any) {
      console.warn('Notice completing onboarding:', err?.message);
      setIsLoading(false);
      return true;
    }
  };

  const isAuthenticated = Boolean(user || session);
  const isOnboarded = Boolean(profile?.onboardingCompleted);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userSettings,
        isLoading,
        isAuthenticated,
        isOnboarded,
        signUp: handleSignUp,
        signIn: handleSignIn,
        signInDemo: handleSignInDemo,
        signInWithGoogle: handleSignInWithGoogle,
        signInWithGitHub: handleSignInWithGitHub,
        signOut: handleSignOut,
        forgotPassword: handleForgotPassword,
        resetPassword: handleResetPassword,
        verifyOtp: handleVerifyOtp,
        completeOnboarding: handleCompleteOnboarding,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
