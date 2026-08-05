import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserSettings } from '../types';

const LOCAL_SETTINGS_KEY = 'flowdesk_user_settings';

export const UserSettingsService = {
  /**
   * Get user settings for authenticated user
   */
  async getUserSettings(userId: string): Promise<UserSettings> {
    const defaultSettings: UserSettings = {
      id: userId,
      currency: 'USD',
      timezone: 'America/New_York',
      date_format: 'MM/DD/YYYY',
      week_start: 'Monday',
      invoice_prefix: 'INV-2026-',
      default_tax_rate: 10,
      tax_name: 'Sales Tax',
    };

    const getLocalSettings = (): UserSettings => {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(`${LOCAL_SETTINGS_KEY}_${userId}`) : null;
      if (stored) {
        try {
          return { ...defaultSettings, ...JSON.parse(stored) };
        } catch {
          // ignore
        }
      }
      return defaultSettings;
    };

    if (!isSupabaseConfigured) {
      return getLocalSettings();
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        return {
          id: data.id,
          currency: data.currency || 'USD',
          timezone: data.timezone || 'America/New_York',
          date_format: data.date_format || 'MM/DD/YYYY',
          week_start: data.week_start || 'Monday',
          invoice_prefix: data.invoice_prefix || 'INV-2026-',
          default_tax_rate: Number(data.default_tax_rate) || 10,
          tax_name: data.tax_name || 'Sales Tax',
        };
      }

      if (error && error.code !== 'PGRST116') {
        console.warn('Notice fetching user settings from Supabase (using local fallback):', error.message);
      }

      return getLocalSettings();
    } catch (err: any) {
      console.warn('Exception in getUserSettings (using local fallback):', err?.message);
      return getLocalSettings();
    }
  },

  /**
   * Save or update user settings
   */
  async saveUserSettings(userId: string, settings: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.getUserSettings(userId);
    const updated: UserSettings = {
      ...current,
      ...settings,
      id: userId,
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${LOCAL_SETTINGS_KEY}_${userId}`, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }

    if (!isSupabaseConfigured) {
      return updated;
    }

    try {
      const { error } = await supabase.from('user_settings').upsert({
        id: userId,
        currency: updated.currency,
        timezone: updated.timezone,
        date_format: updated.date_format,
        week_start: updated.week_start,
        invoice_prefix: updated.invoice_prefix,
        default_tax_rate: updated.default_tax_rate,
        tax_name: updated.tax_name,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.warn('Notice saving user settings in Supabase (using local fallback):', error.message);
      }
    } catch (err: any) {
      console.warn('Exception saving user settings in Supabase:', err?.message);
    }

    return updated;
  },
};
