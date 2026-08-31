import { supabase } from '../lib/supabase';
import { UserProfile, OnboardingData } from '../types';

export const ProfileService = {
  /**
   * Get user profile by Supabase user ID with timeout protection
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'Timeout' } }), 2000)
      );

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error && error.code !== 'PGRST116') {
        console.warn('Notice fetching user profile from Supabase:', error.message);
      }

      if (data) {
        return this.mapSupabaseProfileToUserProfile(data);
      }

      return null;
    } catch (err: any) {
      console.warn('Profile fetch exception:', err?.message);
      return null;
    }
  },

  /**
   * Create or upsert user profile in Supabase
   */
  async upsertProfile(userId: string, profileData: Partial<UserProfile>): Promise<UserProfile> {
    const name = profileData.name || profileData.email?.split('@')[0] || 'User';
    const companyName = profileData.companyName || 'My Workspace';

    const supabasePayload = {
      id: userId,
      full_name: name,
      business_name: companyName,
      company_name: companyName,
      email: profileData.email || '',
      avatar_url: profileData.avatarUrl || '',
      profession: profileData.profession || '',
      country: profileData.country || 'United States',
      timezone: profileData.timezone || 'America/New_York',
      language: profileData.language || 'English',
      onboarding_completed: profileData.onboardingCompleted ?? false,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('profiles').upsert(supabasePayload, { onConflict: 'id' });
      if (error) {
        console.warn('Notice upserting profile in Supabase:', error.message);
      }
    } catch (err: any) {
      console.warn('Exception upserting profile in Supabase:', err?.message);
    }

    return {
      id: userId,
      name,
      title: profileData.title || profileData.profession || 'Independent Specialist',
      email: profileData.email || '',
      avatarUrl: profileData.avatarUrl || '',
      currency: profileData.currency || 'USD',
      companyName,
      hourlyRate: profileData.hourlyRate || 150,
      taxRate: profileData.taxRate || 10,
      notificationsEnabled: profileData.notificationsEnabled ?? true,
      profession: profileData.profession || '',
      country: profileData.country || 'United States',
      timezone: profileData.timezone || 'America/New_York',
      language: profileData.language || 'English',
      onboardingCompleted: profileData.onboardingCompleted ?? false,
    };
  },

  /**
   * Check if user completed onboarding
   */
  async checkOnboardingCompleted(userId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', userId)
        .maybeSingle();

      return Boolean(data?.onboarding_completed);
    } catch {
      return false;
    }
  },

  /**
   * Complete onboarding and update user profile & settings in Supabase
   */
  async saveOnboardingData(userId: string, data: OnboardingData): Promise<UserProfile> {
    const updatedProfile: UserProfile = {
      id: userId,
      name: data.fullName,
      title: data.profession,
      email: '',
      avatarUrl: data.logoUrl || '',
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
  mapSupabaseProfileToUserProfile(sp: any): UserProfile {
    return {
      id: sp.id,
      name: sp.full_name || sp.email?.split('@')[0] || 'User',
      title: sp.profession || 'Independent Specialist',
      email: sp.email || '',
      avatarUrl: sp.avatar_url || '',
      currency: sp.currency || 'USD',
      companyName: sp.business_name || sp.company_name || 'My Workspace',
      hourlyRate: Number(sp.hourly_rate) || 150,
      taxRate: 10,
      notificationsEnabled: true,
      profession: sp.profession || '',
      country: sp.country || 'United States',
      timezone: sp.timezone || 'America/New_York',
      language: sp.language || 'English',
      onboardingCompleted: Boolean(sp.onboarding_completed),
    };
  },
};
