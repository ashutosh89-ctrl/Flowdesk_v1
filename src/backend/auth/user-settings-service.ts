import { supabase } from '@/backend/utilities/supabase';
import { UserSettings } from '@/shared/types';

const LOCAL_SETTINGS_PREFIX = 'flowdesk_user_settings_';

export const DEFAULT_USER_SETTINGS: UserSettings = {
  id: 'usr-default',
  currency: 'USD',
  timezone: 'America/New_York',
  date_format: 'MM/DD/YYYY',
  week_start: 'Monday',
  invoice_prefix: 'INV',
  invoice_number_format: 'prefix_year_sequence',
  invoice_separator: '-',
  invoice_include_year: true,
  invoice_padding: 4,
  invoice_next_sequence: 1,
  invoice_annual_reset: false,
  default_tax_rate: 0,
  tax_name: 'Tax',
  default_payment_terms: 14,
  email_notifications: true,
  email_deliverables: true,
  email_documents: true,
  email_invoices: true,
  invoice_reminders: true,
  comment_alerts: true,
  weekly_digest: false,
};

export const UserSettingsService = {
  /**
   * Get user settings from Supabase with localStorage and fallback defaults
   */
  async getUserSettings(userId?: string | null): Promise<UserSettings> {
    const targetUserId = userId || 'usr-default';

    // 1. Try fetching from Supabase if configured and authenticated user
    if (userId && userId !== 'usr-default' && !userId.startsWith('usr-demo')) {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!error && data) {
          const settings: UserSettings = {
            id: data.id,
            currency: data.currency || 'USD',
            timezone: data.timezone || 'America/New_York',
            date_format: data.date_format || 'MM/DD/YYYY',
            week_start: data.week_start || 'Monday',
            invoice_prefix: data.invoice_prefix || 'INV',
            invoice_number_format: data.invoice_number_format || 'prefix_year_sequence',
            invoice_separator: data.invoice_separator !== undefined ? data.invoice_separator : '-',
            invoice_include_year: data.invoice_include_year !== undefined ? Boolean(data.invoice_include_year) : true,
            invoice_padding: data.invoice_padding ? Number(data.invoice_padding) : 4,
            invoice_next_sequence: data.invoice_next_sequence ? Number(data.invoice_next_sequence) : 1,
            invoice_annual_reset: data.invoice_annual_reset !== undefined ? Boolean(data.invoice_annual_reset) : false,
            default_tax_rate: Number(data.default_tax_rate) || 0,
            tax_name: data.tax_name || 'Tax',
            default_payment_terms: Number(data.default_payment_terms) || 14,
            email_notifications: data.email_notifications !== undefined ? Boolean(data.email_notifications) : true,
            email_deliverables: data.email_deliverables !== undefined ? Boolean(data.email_deliverables) : true,
            email_documents: data.email_documents !== undefined ? Boolean(data.email_documents) : true,
            email_invoices: data.email_invoices !== undefined ? Boolean(data.email_invoices) : true,
            invoice_reminders: data.invoice_reminders !== undefined ? Boolean(data.invoice_reminders) : true,
            comment_alerts: data.comment_alerts !== undefined ? Boolean(data.comment_alerts) : true,
            weekly_digest: data.weekly_digest !== undefined ? Boolean(data.weekly_digest) : false,
          };
          this.setLocalSettings(userId, settings);
          return settings;
        }
      } catch (err: any) {
        console.warn('Settings fetch from Supabase notice:', err?.message);
      }
    }

    // 2. Check local storage cache
    const cached = this.getLocalSettings(targetUserId);
    if (cached) {
      return cached;
    }

    // 3. Fall back to default settings and persist locally
    const fallbackSettings: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      id: targetUserId,
    };
    this.setLocalSettings(targetUserId, fallbackSettings);
    return fallbackSettings;
  },

  /**
   * Save user settings to localStorage and sync to Supabase if available
   */
  async saveUserSettings(userId?: string | null, updates: Partial<UserSettings> = {}): Promise<UserSettings> {
    const targetUserId = userId || 'usr-default';

    const currentSettings = await this.getUserSettings(targetUserId);
    const mergedSettings: UserSettings = {
      id: targetUserId,
      currency: updates.currency || currentSettings.currency || 'USD',
      timezone: updates.timezone || currentSettings.timezone || 'America/New_York',
      date_format: updates.date_format || currentSettings.date_format || 'MM/DD/YYYY',
      week_start: updates.week_start || currentSettings.week_start || 'Monday',
      invoice_prefix: updates.invoice_prefix !== undefined ? updates.invoice_prefix : (currentSettings.invoice_prefix || 'INV'),
      invoice_number_format: updates.invoice_number_format || currentSettings.invoice_number_format || 'prefix_year_sequence',
      invoice_separator: updates.invoice_separator !== undefined ? updates.invoice_separator : (currentSettings.invoice_separator ?? '-'),
      invoice_include_year: updates.invoice_include_year !== undefined ? updates.invoice_include_year : (currentSettings.invoice_include_year ?? true),
      invoice_padding: updates.invoice_padding !== undefined ? updates.invoice_padding : (currentSettings.invoice_padding ?? 4),
      invoice_next_sequence: updates.invoice_next_sequence !== undefined ? updates.invoice_next_sequence : (currentSettings.invoice_next_sequence ?? 1),
      invoice_annual_reset: updates.invoice_annual_reset !== undefined ? updates.invoice_annual_reset : (currentSettings.invoice_annual_reset ?? false),
      default_tax_rate: updates.default_tax_rate !== undefined ? updates.default_tax_rate : (currentSettings.default_tax_rate ?? 0),
      tax_name: updates.tax_name !== undefined ? updates.tax_name : (currentSettings.tax_name || 'Tax'),
      default_payment_terms: updates.default_payment_terms !== undefined ? updates.default_payment_terms : (currentSettings.default_payment_terms ?? 14),
      email_notifications: updates.email_notifications !== undefined ? updates.email_notifications : (currentSettings.email_notifications ?? true),
      email_deliverables: updates.email_deliverables !== undefined ? updates.email_deliverables : (currentSettings.email_deliverables ?? true),
      email_documents: updates.email_documents !== undefined ? updates.email_documents : (currentSettings.email_documents ?? true),
      email_invoices: updates.email_invoices !== undefined ? updates.email_invoices : (currentSettings.email_invoices ?? true),
      invoice_reminders: updates.invoice_reminders !== undefined ? updates.invoice_reminders : (currentSettings.invoice_reminders ?? true),
      comment_alerts: updates.comment_alerts !== undefined ? updates.comment_alerts : (currentSettings.comment_alerts ?? true),
      weekly_digest: updates.weekly_digest !== undefined ? updates.weekly_digest : (currentSettings.weekly_digest ?? false),
    };

    // Always cache locally
    this.setLocalSettings(targetUserId, mergedSettings);

    // Sync to Supabase if valid user
    if (userId && userId !== 'usr-default' && !userId.startsWith('usr-demo')) {
      try {
        const payload: any = {
          id: userId,
          updated_at: new Date().toISOString(),
        };
        if (updates.currency !== undefined) payload.currency = updates.currency;
        if (updates.timezone !== undefined) payload.timezone = updates.timezone;
        if (updates.date_format !== undefined) payload.date_format = updates.date_format;
        if (updates.week_start !== undefined) payload.week_start = updates.week_start;
        if (updates.invoice_prefix !== undefined) payload.invoice_prefix = updates.invoice_prefix;
        if (updates.invoice_number_format !== undefined) payload.invoice_number_format = updates.invoice_number_format;
        if (updates.invoice_separator !== undefined) payload.invoice_separator = updates.invoice_separator;
        if (updates.invoice_include_year !== undefined) payload.invoice_include_year = updates.invoice_include_year;
        if (updates.invoice_padding !== undefined) payload.invoice_padding = updates.invoice_padding;
        if (updates.invoice_next_sequence !== undefined) payload.invoice_next_sequence = updates.invoice_next_sequence;
        if (updates.invoice_annual_reset !== undefined) payload.invoice_annual_reset = updates.invoice_annual_reset;
        if (updates.default_tax_rate !== undefined) payload.default_tax_rate = updates.default_tax_rate;
        if (updates.tax_name !== undefined) payload.tax_name = updates.tax_name;
        if (updates.default_payment_terms !== undefined) payload.default_payment_terms = updates.default_payment_terms;
        if (updates.email_notifications !== undefined) payload.email_notifications = updates.email_notifications;
        if (updates.email_deliverables !== undefined) payload.email_deliverables = updates.email_deliverables;
        if (updates.email_documents !== undefined) payload.email_documents = updates.email_documents;
        if (updates.email_invoices !== undefined) payload.email_invoices = updates.email_invoices;
        if (updates.invoice_reminders !== undefined) payload.invoice_reminders = updates.invoice_reminders;
        if (updates.comment_alerts !== undefined) payload.comment_alerts = updates.comment_alerts;
        if (updates.weekly_digest !== undefined) payload.weekly_digest = updates.weekly_digest;

        const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'id' });
        if (error) {
          console.warn('Supabase settings upsert error:', error.message);
          throw error;
        }
      } catch (err: any) {
        console.warn('Supabase settings sync notice:', err?.message);
        throw err;
      }
    }

    return mergedSettings;
  },

  /**
   * Get settings from localStorage (user-scoped key)
   */
  getLocalSettings(userId: string): UserSettings | null {
    if (typeof window === 'undefined') return null;
    if (!userId) return null;
    try {
      const key = `${LOCAL_SETTINGS_PREFIX}${userId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return null;
  },

  /**
   * Save settings to localStorage (user-scoped key)
   */
  setLocalSettings(userId: string, settings: UserSettings): void {
    if (typeof window === 'undefined') return;
    if (!userId) return;
    try {
      const key = `${LOCAL_SETTINGS_PREFIX}${userId}`;
      localStorage.setItem(key, JSON.stringify(settings));
    } catch {
      // ignore
    }
  },

  /**
   * Reset user settings in Supabase to DEFAULT_USER_SETTINGS and clear local cache
   */
  async resetUserSettings(userId?: string | null): Promise<UserSettings> {
    const targetUserId = userId || 'usr-default';
    const defaultSettings: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      id: targetUserId,
    };

    // 1. Sync default settings to Supabase
    if (userId && userId !== 'usr-default' && !userId.startsWith('usr-demo')) {
      try {
        const payload: any = {
          id: userId,
          currency: DEFAULT_USER_SETTINGS.currency,
          timezone: DEFAULT_USER_SETTINGS.timezone,
          date_format: DEFAULT_USER_SETTINGS.date_format,
          week_start: DEFAULT_USER_SETTINGS.week_start,
          invoice_prefix: DEFAULT_USER_SETTINGS.invoice_prefix,
          invoice_number_format: DEFAULT_USER_SETTINGS.invoice_number_format,
          invoice_separator: DEFAULT_USER_SETTINGS.invoice_separator,
          invoice_include_year: DEFAULT_USER_SETTINGS.invoice_include_year,
          invoice_padding: DEFAULT_USER_SETTINGS.invoice_padding,
          invoice_next_sequence: DEFAULT_USER_SETTINGS.invoice_next_sequence,
          invoice_annual_reset: DEFAULT_USER_SETTINGS.invoice_annual_reset,
          default_tax_rate: DEFAULT_USER_SETTINGS.default_tax_rate,
          tax_name: DEFAULT_USER_SETTINGS.tax_name,
          default_payment_terms: DEFAULT_USER_SETTINGS.default_payment_terms,
          email_notifications: DEFAULT_USER_SETTINGS.email_notifications,
          invoice_reminders: DEFAULT_USER_SETTINGS.invoice_reminders,
          comment_alerts: DEFAULT_USER_SETTINGS.comment_alerts,
          weekly_digest: DEFAULT_USER_SETTINGS.weekly_digest,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'id' });
        if (error) {
          console.warn('Supabase settings reset error:', error.message);
          throw error;
        }
      } catch (err: any) {
        console.warn('Supabase settings reset notice:', err?.message);
        throw err;
      }
    }

    // 2. Clear & update local cache
    this.setLocalSettings(targetUserId, defaultSettings);
    return defaultSettings;
  },

  /**
   * Clear user-specific settings cache
   */
  clearLocalSettings(userId: string): void {
    if (typeof window === 'undefined') return;
    if (!userId) return;
    try {
      const key = `${LOCAL_SETTINGS_PREFIX}${userId}`;
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
