import { supabase, isDemoModeActive } from '@/backend/utilities/supabase';
import { UserProfile } from '@/shared/types';
import { mockUserProfile } from '@/backend/store/mockData';

export const ProfileService = {
  /**
   * Get user profile by Supabase user ID
   */
  async getProfile(userId: string): Promise<UserProfile | null> {
    // Demo mode: check local profile store first, fallback to mock profile
    if (isDemoModeActive()) {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(`flowdesk_profile_${userId}`);
        if (stored) {
          try {
            return JSON.parse(stored) as UserProfile;
          } catch {}
        }
      }
      return { ...mockUserProfile, id: userId, onboardingCompleted: true };
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Error fetching user profile from Supabase:', error.message);
        return null;
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

    // Demo mode: return local profile without Supabase persistence
    if (isDemoModeActive()) {
      const demoProfile: UserProfile = {
        id: userId,
        name,
        title: profileData.title || profileData.profession || 'Independent Specialist',
        email: profileData.email || '',
        avatarUrl: profileData.avatarUrl || '',
        currency: profileData.currency || 'USD',
        companyName,
        hourlyRate: profileData.hourlyRate || 120,
        profession: profileData.profession || '',
        country: profileData.country || 'India',
        timezone: profileData.timezone || 'Asia/Kolkata',
        language: profileData.language || 'English',
        onboardingCompleted: profileData.onboardingCompleted ?? true,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(`flowdesk_profile_${userId}`, JSON.stringify(demoProfile));
      }
      return demoProfile;
    }

    const localProfile: UserProfile = {
      id: userId,
      name,
      title: profileData.title || profileData.profession || 'Independent Specialist',
      email: profileData.email || '',
      avatarUrl: profileData.avatarUrl || '',
      logoUrl: profileData.logoUrl || '',
      signatureUrl: profileData.signatureUrl || '',
      currency: profileData.currency || 'USD',
      companyName,
      hourlyRate: profileData.hourlyRate || 120,
      profession: profileData.profession || '',
      country: profileData.country || 'India',
      timezone: profileData.timezone || 'Asia/Kolkata',
      language: profileData.language || 'English',
      onboardingCompleted: profileData.onboardingCompleted ?? false,
    };

    const supabasePayload: any = {
      id: userId,
      full_name: name,
      business_name: companyName,
      company_name: companyName,
      email: profileData.email || '',
      avatar_url: profileData.avatarUrl || '',
      profession: profileData.profession || '',
      country: profileData.country || 'India',
      timezone: profileData.timezone || 'Asia/Kolkata',
      language: profileData.language || 'English',
      onboarding_completed: profileData.onboardingCompleted ?? false,
      updated_at: new Date().toISOString(),
    };

    if (profileData.phone !== undefined) supabasePayload.phone = profileData.phone;
    if (profileData.logoUrl !== undefined) supabasePayload.logo_url = profileData.logoUrl;
    if (profileData.signatureUrl !== undefined) supabasePayload.signature_url = profileData.signatureUrl;

    const { error } = await supabase.from('profiles').upsert(supabasePayload, { onConflict: 'id' });
    if (error) {
      console.error('Profile persistence failed:', error.message);
      throw new Error(`Profile could not be saved: ${error.message}`);
    }

    return localProfile;
  },

  /**
   * Check if user completed onboarding
   */
  async checkOnboardingCompleted(userId: string): Promise<boolean> {
    // Demo mode: always consider onboarded
    if (isDemoModeActive()) return true;
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
   * Complete onboarding and update user profile
   */
  async saveOnboardingData(userId: string, data: any): Promise<UserProfile> {
    const updatedProfile: UserProfile = {
      id: userId,
      name: data.fullName,
      title: data.profession,
      email: '',
      avatarUrl: data.logoUrl || '',
      logoUrl: data.logoUrl || '',
      signatureUrl: data.signatureUrl || '',
      currency: data.currency,
      companyName: data.businessName,
      hourlyRate: 120,
      profession: data.profession,
      country: data.country || 'India',
      timezone: data.timezone || 'Asia/Kolkata',
      language: data.language,
      onboardingCompleted: true,
    };

    return this.upsertProfile(userId, updatedProfile);
  },

  /**
   * Mapper helper — maps Supabase profiles row to UserProfile
   * Only maps columns that actually exist in the database schema
   */
  mapSupabaseProfileToUserProfile(sp: any): UserProfile {
    return {
      id: sp.id,
      name: sp.full_name || sp.email?.split('@')[0] || 'New User',
      title: sp.profession || 'Independent Specialist',
      email: sp.email || '',
      avatarUrl: sp.avatar_url || '',
      logoUrl: sp.logo_url || '',
      signatureUrl: sp.signature_url || '',
      currency: sp.currency || 'USD',
      companyName: sp.business_name || sp.company_name || 'My Workspace',
      hourlyRate: Number(sp.hourly_rate) || 120,
      profession: sp.profession || '',
      country: sp.country || 'India',
      timezone: sp.timezone || 'Asia/Kolkata',
      language: sp.language || 'English',
      phone: sp.phone || '',
      onboardingCompleted: Boolean(sp.onboarding_completed),
    };
  },
};
