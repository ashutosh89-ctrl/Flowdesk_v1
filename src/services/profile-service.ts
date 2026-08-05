import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SupabaseProfile, UserProfile, OnboardingData } from '../types';
import { mockUserProfile } from '../mock/mockData';

// Local storage key for persistent demo state when Supabase keys aren't configured
const LOCAL_PROFILE_KEY = 'flowdesk_user_profile';
const LOCAL_ONBOARDING_KEY = 'flowdesk_onboarding_status';

export const ProfileService = {
  /**
   * Get user profile by Supabase user ID
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    const getLocalProfile = (): UserProfile => {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(`${LOCAL_PROFILE_KEY}_${userId}`) : null;
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // fallback
        }
      }
      return {
        ...mockUserProfile,
        id: userId,
        onboardingCompleted: typeof window !== 'undefined' ? localStorage.getItem(`${LOCAL_ONBOARDING_KEY}_${userId}`) === 'true' : false,
      };
    };

    if (!isSupabaseConfigured) {
      return getLocalProfile();
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        return this.mapSupabaseProfileToUserProfile(data);
      }

      if (error && error.code !== 'PGRST116') {
        console.warn('Notice fetching user profile from Supabase (using local fallback):', error.message);
      }

      return getLocalProfile();
    } catch (err: any) {
      console.warn('Profile fetch exception (using local fallback):', err?.message);
      return getLocalProfile();
    }
  },

  /**
   * Create or upsert user profile
   */
  async upsertProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
    const updatedProfile: UserProfile = {
      id: userId,
      name: profileData.name || 'Alex Rivera',
      title: profileData.profession || profileData.title || 'Independent Specialist',
      email: profileData.email || 'alex@riveradesign.co',
      avatarUrl: profileData.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      currency: profileData.currency || 'USD',
      companyName: profileData.companyName || 'Rivera Studio',
      hourlyRate: profileData.hourlyRate || 150,
      taxRate: profileData.taxRate || 10,
      notificationsEnabled: profileData.notificationsEnabled ?? true,
      profession: profileData.profession || 'Creative Director',
      country: profileData.country || 'United States',
      timezone: profileData.timezone || 'America/New_York',
      language: profileData.language || 'English',
      onboardingCompleted: profileData.onboardingCompleted ?? false,
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${LOCAL_PROFILE_KEY}_${userId}`, JSON.stringify(updatedProfile));
        localStorage.setItem(`${LOCAL_ONBOARDING_KEY}_${userId}`, String(updatedProfile.onboardingCompleted));
      } catch {
        // ignore quota errors
      }
    }

    if (!isSupabaseConfigured) {
      return updatedProfile;
    }

    const supabasePayload: Partial<SupabaseProfile> = {
      id: userId,
      full_name: updatedProfile.name,
      avatar_url: updatedProfile.avatarUrl,
      business_name: updatedProfile.companyName,
      profession: updatedProfile.profession,
      country: updatedProfile.country,
      timezone: updatedProfile.timezone,
      language: updatedProfile.language,
      onboarding_completed: updatedProfile.onboardingCompleted,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('profiles').upsert(supabasePayload);
      if (error) {
        console.warn('Notice upserting profile in Supabase (using local fallback):', error.message);
      }
    } catch (err: any) {
      console.warn('Exception upserting profile in Supabase:', err?.message);
    }

    return updatedProfile;
  },

  /**
   * Check if user completed onboarding
   */
  async checkOnboardingCompleted(userId: string): Promise<boolean> {
    const getLocalStatus = () => (typeof window !== 'undefined' ? localStorage.getItem(`${LOCAL_ONBOARDING_KEY}_${userId}`) === 'true' : false);

    if (!isSupabaseConfigured) {
      return getLocalStatus();
    }

    try {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', userId)
        .single();

      if (data && typeof data.onboarding_completed === 'boolean') {
        return data.onboarding_completed;
      }
      return getLocalStatus();
    } catch {
      return getLocalStatus();
    }
  },

  /**
   * Complete onboarding and update user profile & settings
   */
  async saveOnboardingData(userId: string, data: OnboardingData): Promise<UserProfile> {
    const updatedProfile: UserProfile = {
      id: userId,
      name: data.fullName,
      title: data.profession,
      email: '',
      avatarUrl: data.logoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      currency: data.currency,
      companyName: data.businessName,
      hourlyRate: 150,
      taxRate: data.taxRate,
      notificationsEnabled: true,
      profession: data.profession,
      country: data.country,
      timezone: data.timezone,
      language: data.language,
      onboardingCompleted: true,
    };

    return this.upsertProfile(userId, updatedProfile);
  },

  /**
   * Mapper helper
   */
  mapSupabaseProfileToUserProfile(sp: SupabaseProfile): UserProfile {
    return {
      id: sp.id,
      name: sp.full_name || 'FlowDesk Member',
      title: sp.profession || 'Independent Specialist',
      email: '',
      avatarUrl: sp.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      currency: 'USD',
      companyName: sp.business_name || 'Studio',
      hourlyRate: 150,
      taxRate: 10,
      notificationsEnabled: true,
      profession: sp.profession || '',
      country: sp.country || 'United States',
      timezone: sp.timezone || 'America/New_York',
      language: sp.language || 'English',
      onboardingCompleted: sp.onboarding_completed,
    };
  },
};
