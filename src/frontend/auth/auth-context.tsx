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
      }
      setProfile(fetchedProfile);

      const settings = await UserSettingsService.getUserSettings(userId);
      setUserSettings(settings);
    } catch (err: any) {
      console.warn('Error loading profile/settings:', err?.message);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    let mounted = true;

    // Safety fallback: guarantee isLoading becomes false within 1.5s max
    const timer = setTimeout(() => {
      if (mounted) {
        setIsLoading(false);
      }
    }, 1500);

    async function initAuth() {
      try {
        const { session: initialSession, user: initialUser } = await SessionService.getSession();
        if (mounted) {
          setSession(initialSession);
          setUser(initialUser);

          if (initialUser) {
            await loadProfileAndSettings(initialUser.id, initialUser);
          } else {
            setProfile(null);
            setUserSettings(null);
          }
        }
      } catch (err: any) {
        console.warn('Notice initializing auth:', err?.message);
      } finally {
        if (mounted) {
          clearTimeout(timer);
          setIsLoading(false);
        }
      }
    }

    initAuth();

    // Listen to Supabase auth state changes
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
      clearTimeout(timer);
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
