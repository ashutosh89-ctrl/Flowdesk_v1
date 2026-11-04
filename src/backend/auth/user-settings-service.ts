import { supabase } from '@/backend/utilities/supabase';
import { UserSettings, FreelancerPaymentSettings } from '@/shared/types';
import { isServerMutationBatchEnabled } from '@/shared/config/feature-flags';

const LOCAL_SETTINGS_PREFIX = 'flowdesk_user_settings_';
const LOCAL_PAYMENT_PREFIX = 'flowdesk_payment_settings_';

export const DEFAULT_USER_SETTINGS: UserSettings = {
  id: 'usr-default',
  currency: 'INR',
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
  email_invitations: true,
  invoice_reminders: true,
  comment_alerts: true,
  weekly_digest: false,
  default_deliverable_niche: 'software_development',
};

export const UserSettingsService = {
  /**
   * Get user settings from Supabase with localStorage and fallback defaults
   */
  async getUserSettings(userId?: string | null): Promise<UserSettings> {
    const targetUserId = userId || 'usr-default';
    const local = this.getLocalSettings(targetUserId) || (targetUserId !== 'usr-default' ? this.getLocalSettings('usr-default') : null);
    const localPayment = this.getPaymentSettings(targetUserId) || (targetUserId !== 'usr-default' ? this.getPaymentSettings('usr-default') : null);

    // 1. Try fetching from Supabase if configured and authenticated user
    if (userId && userId !== 'usr-default' && !userId.startsWith('usr-demo')) {
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!error && data) {
          const remoteBank = data.payment_settings?.bankDetails || {};
          const localBank = local?.payment_settings?.bankDetails || {};
          const localPayBank = localPayment?.bankDetails || {};

          let bankName = data.bank_name || remoteBank.bankName || local?.bank_name || localBank.bankName || localPayBank.bankName || '';
          let accountHolderName = data.account_holder_name || remoteBank.accountHolderName || local?.account_holder_name || localBank.accountHolderName || localPayBank.accountHolderName || '';
          let accountNumber = data.account_number || remoteBank.accountNumber || local?.account_number || localBank.accountNumber || localPayBank.accountNumber || '';
          let ifscCode = data.ifsc_code || remoteBank.ifscCode || local?.ifsc_code || localBank.ifscCode || localPayBank.ifscCode || '';
          let branchName = data.branch_name || remoteBank.branchName || local?.branch_name || localBank.branchName || localPayBank.branchName || '';
          let upiId = data.upi_id || data.payment_settings?.upiId || local?.upi_id || local?.payment_settings?.upiId || localPayment?.upiId || '';
          let upiQrCodeUrl = data.upi_qr_code_url || data.payment_settings?.upiQrCodeUrl || local?.upi_qr_code_url || local?.payment_settings?.upiQrCodeUrl || localPayment?.upiQrCodeUrl || '';
          let razorpayPaymentLink = data.razorpay_payment_link || data.payment_settings?.razorpayPaymentLink || local?.razorpay_payment_link || local?.payment_settings?.razorpayPaymentLink || localPayment?.razorpayPaymentLink || '';
          let defaultPaymentInstructions = data.payment_settings?.defaultPaymentInstructions || local?.payment_settings?.defaultPaymentInstructions || localPayment?.defaultPaymentInstructions || '';

          if (typeof window !== 'undefined' && (!bankName || !accountNumber || !upiId)) {
            try {
              const res = await fetch('/api/account/settings', { cache: 'no-store' });
              if (res.ok) {
                const apiJson = await res.json();
                if (apiJson.success && apiJson.settings) {
                  const s = apiJson.settings;
                  const sp = s.payment_settings;
                  const sb = sp?.bankDetails;
                  if (!bankName) bankName = s.bank_name || sb?.bankName || '';
                  if (!accountHolderName) accountHolderName = s.account_holder_name || sb?.accountHolderName || '';
                  if (!accountNumber) accountNumber = s.account_number || sb?.accountNumber || '';
                  if (!ifscCode) ifscCode = s.ifsc_code || sb?.ifscCode || '';
                  if (!branchName) branchName = s.branch_name || sb?.branchName || '';
                  if (!upiId) upiId = s.upi_id || sp?.upiId || '';
                  if (!upiQrCodeUrl) upiQrCodeUrl = s.upi_qr_code_url || sp?.upiQrCodeUrl || '';
                  if (!razorpayPaymentLink) razorpayPaymentLink = s.razorpay_payment_link || sp?.razorpayPaymentLink || '';
                  if (!defaultPaymentInstructions) defaultPaymentInstructions = sp?.defaultPaymentInstructions || '';
                }
              }
            } catch {
              // non-critical background fetch
            }
          }

          const resolvedPaymentSettings: FreelancerPaymentSettings = {
            bankTransferEnabled: data.payment_settings?.bankTransferEnabled ?? local?.payment_settings?.bankTransferEnabled ?? localPayment?.bankTransferEnabled ?? Boolean(bankName || accountNumber || true),
            upiEnabled: data.payment_settings?.upiEnabled ?? local?.payment_settings?.upiEnabled ?? localPayment?.upiEnabled ?? Boolean(upiId || upiQrCodeUrl),
            razorpayLinkEnabled: data.payment_settings?.razorpayLinkEnabled ?? local?.payment_settings?.razorpayLinkEnabled ?? localPayment?.razorpayLinkEnabled ?? Boolean(razorpayPaymentLink),
            upiId,
            upiQrCodeUrl,
            bankDetails: {
              accountHolderName,
              bankName,
              accountNumber,
              ifscCode,
              branchName,
              upiId,
            },
            razorpayPaymentLink,
            defaultPaymentInstructions,
            ...(local?.payment_settings || {}),
            ...(localPayment || {}),
            ...(data.payment_settings || {}),
          };

          const settings: UserSettings = {
            id: data.id,
            currency: (data.currency && data.currency !== 'USD') ? data.currency : (local?.currency || data.currency || 'INR'),
            timezone: data.timezone || local?.timezone || 'Asia/Kolkata',
            date_format: data.date_format || local?.date_format || 'DD/MM/YYYY',
            week_start: data.week_start || local?.week_start || 'Monday',
            invoice_prefix: data.invoice_prefix || local?.invoice_prefix || 'INV',
            invoice_number_format: data.invoice_number_format || local?.invoice_number_format || 'prefix_year_sequence',
            invoice_separator: data.invoice_separator !== undefined ? data.invoice_separator : (local?.invoice_separator ?? '-'),
            invoice_include_year: data.invoice_include_year !== undefined ? Boolean(data.invoice_include_year) : (local?.invoice_include_year ?? true),
            invoice_padding: data.invoice_padding ? Number(data.invoice_padding) : (local?.invoice_padding ?? 4),
            invoice_next_sequence: data.invoice_next_sequence ? Number(data.invoice_next_sequence) : (local?.invoice_next_sequence ?? 1),
            invoice_annual_reset: data.invoice_annual_reset !== undefined ? Boolean(data.invoice_annual_reset) : (local?.invoice_annual_reset ?? false),
            default_tax_rate: typeof data.default_tax_rate === 'number' ? data.default_tax_rate : (local?.default_tax_rate ?? 0),
            tax_name: data.tax_name || local?.tax_name || DEFAULT_USER_SETTINGS.tax_name || 'Tax',
            default_payment_terms: Number(data.default_payment_terms) || local?.default_payment_terms || 14,
            email_notifications: data.email_notifications !== undefined ? Boolean(data.email_notifications) : (local?.email_notifications ?? true),
            email_deliverables: data.email_deliverables !== undefined ? Boolean(data.email_deliverables) : (local?.email_deliverables ?? true),
            email_documents: data.email_documents !== undefined ? Boolean(data.email_documents) : (local?.email_documents ?? true),
            email_invoices: data.email_invoices !== undefined ? Boolean(data.email_invoices) : (local?.email_invoices ?? true),
            email_invitations: data.email_invitations !== undefined ? Boolean(data.email_invitations) : (local?.email_invitations ?? true),
            invoice_reminders: data.invoice_reminders !== undefined ? Boolean(data.invoice_reminders) : (local?.invoice_reminders ?? true),
            comment_alerts: data.comment_alerts !== undefined ? Boolean(data.comment_alerts) : (local?.comment_alerts ?? true),
            weekly_digest: data.weekly_digest !== undefined ? Boolean(data.weekly_digest) : (local?.weekly_digest ?? false),
            default_deliverable_niche: data.default_deliverable_niche === 'others' ? 'others' : (local?.default_deliverable_niche || 'software_development'),
            payment_settings: resolvedPaymentSettings,
            upi_id: upiId,
            upi_qr_code_url: upiQrCodeUrl,
            bank_name: bankName,
            account_holder_name: accountHolderName,
            account_number: accountNumber,
            ifsc_code: ifscCode,
            branch_name: branchName,
            razorpay_payment_link: razorpayPaymentLink,
          };

          // Redundancy check: if UPI QR or ID is missing from user_settings table, check profiles
          if (!settings.upi_qr_code_url || !settings.upi_id) {
            try {
              const { data: prof } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
              if (prof) {
                if (!settings.upi_qr_code_url && prof.upi_qr_code_url) {
                  settings.upi_qr_code_url = prof.upi_qr_code_url;
                  settings.payment_settings = {
                    ...settings.payment_settings,
                    upiQrCodeUrl: prof.upi_qr_code_url,
                    upiEnabled: true,
                  };
                }
                if (!settings.upi_id && prof.upi_id) {
                  settings.upi_id = prof.upi_id;
                  settings.payment_settings = {
                    ...settings.payment_settings,
                    upiId: prof.upi_id,
                  };
                }
                if (prof.currency && (!settings.currency || settings.currency === 'USD')) {
                  settings.currency = prof.currency;
                }
              }
            } catch {
              // non-critical
            }
          }

          this.setLocalSettings(userId, settings);
          this.setPaymentSettings(userId, settings.payment_settings || {});
          if (userId !== 'usr-default') {
            this.setLocalSettings('usr-default', settings);
            this.setPaymentSettings('usr-default', settings.payment_settings || {});
          }
          return settings;
        }
      } catch (err: any) {
        console.warn('Settings fetch from Supabase notice:', err?.message);
      }
    }

    // 2. Check local storage cache (with fallback to usr-default)
    const cached = this.getLocalSettings(targetUserId) || (targetUserId !== 'usr-default' ? this.getLocalSettings('usr-default') : null);
    if (cached) {
      if (localPayment) {
        cached.payment_settings = { ...(cached.payment_settings || {}), ...localPayment };
        cached.bank_name = cached.bank_name || localPayment.bankDetails?.bankName || '';
        cached.account_holder_name = cached.account_holder_name || localPayment.bankDetails?.accountHolderName || '';
        cached.account_number = cached.account_number || localPayment.bankDetails?.accountNumber || '';
        cached.ifsc_code = cached.ifsc_code || localPayment.bankDetails?.ifscCode || '';
        cached.branch_name = cached.branch_name || localPayment.bankDetails?.branchName || '';
        cached.upi_id = cached.upi_id || localPayment.upiId || '';
        cached.upi_qr_code_url = cached.upi_qr_code_url || localPayment.upiQrCodeUrl || '';
      }
      return cached;
    }

    // 3. Fall back to default settings and persist locally
    const fallbackSettings: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      id: targetUserId,
    };
    if (localPayment) {
      fallbackSettings.payment_settings = { ...localPayment };
      fallbackSettings.bank_name = localPayment.bankDetails?.bankName || '';
      fallbackSettings.account_holder_name = localPayment.bankDetails?.accountHolderName || '';
      fallbackSettings.account_number = localPayment.bankDetails?.accountNumber || '';
      fallbackSettings.ifsc_code = localPayment.bankDetails?.ifscCode || '';
      fallbackSettings.branch_name = localPayment.bankDetails?.branchName || '';
      fallbackSettings.upi_id = localPayment.upiId || '';
      fallbackSettings.upi_qr_code_url = localPayment.upiQrCodeUrl || '';
    }
    this.setLocalSettings(targetUserId, fallbackSettings);
    return fallbackSettings;
  },

  /**
   * Save user settings to localStorage and sync to Supabase if available
   */
  async saveUserSettings(userId?: string | null, updates: Partial<UserSettings> = {}): Promise<UserSettings> {
    const targetUserId = userId || 'usr-default';

    const currentSettings = await this.getUserSettings(targetUserId);

    const paymentBank = updates.payment_settings?.bankDetails || {};
    const bankName = updates.bank_name ?? paymentBank.bankName ?? currentSettings.bank_name ?? currentSettings.payment_settings?.bankDetails?.bankName ?? '';
    const accountHolderName = updates.account_holder_name ?? paymentBank.accountHolderName ?? currentSettings.account_holder_name ?? currentSettings.payment_settings?.bankDetails?.accountHolderName ?? '';
    const accountNumber = updates.account_number ?? paymentBank.accountNumber ?? currentSettings.account_number ?? currentSettings.payment_settings?.bankDetails?.accountNumber ?? '';
    const ifscCode = updates.ifsc_code ?? paymentBank.ifscCode ?? currentSettings.ifsc_code ?? currentSettings.payment_settings?.bankDetails?.ifscCode ?? '';
    const branchName = updates.branch_name ?? paymentBank.branchName ?? currentSettings.branch_name ?? currentSettings.payment_settings?.bankDetails?.branchName ?? '';
    const upiId = updates.upi_id ?? updates.payment_settings?.upiId ?? currentSettings.upi_id ?? currentSettings.payment_settings?.upiId ?? '';
    const upiQrCodeUrl = updates.upi_qr_code_url ?? updates.payment_settings?.upiQrCodeUrl ?? currentSettings.upi_qr_code_url ?? currentSettings.payment_settings?.upiQrCodeUrl ?? '';
    const razorpayPaymentLink = updates.razorpay_payment_link ?? updates.payment_settings?.razorpayPaymentLink ?? currentSettings.razorpay_payment_link ?? currentSettings.payment_settings?.razorpayPaymentLink ?? '';
    const defaultPaymentInstructions = updates.payment_settings?.defaultPaymentInstructions ?? currentSettings.payment_settings?.defaultPaymentInstructions ?? '';

    const effectivePaymentSettings: FreelancerPaymentSettings = {
      bankTransferEnabled: updates.payment_settings?.bankTransferEnabled ?? currentSettings.payment_settings?.bankTransferEnabled ?? Boolean(bankName || accountNumber || true),
      upiEnabled: updates.payment_settings?.upiEnabled ?? currentSettings.payment_settings?.upiEnabled ?? Boolean(upiId || upiQrCodeUrl),
      razorpayLinkEnabled: updates.payment_settings?.razorpayLinkEnabled ?? currentSettings.payment_settings?.razorpayLinkEnabled ?? Boolean(razorpayPaymentLink),
      upiId,
      upiQrCodeUrl,
      bankDetails: {
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode,
        branchName,
        upiId,
      },
      razorpayPaymentLink,
      defaultPaymentInstructions,
      ...(updates.payment_settings || {}),
    };

    const mergedSettings: UserSettings = {
      id: targetUserId,
      currency: updates.currency || currentSettings.currency || 'INR',
      timezone: updates.timezone || currentSettings.timezone || 'Asia/Kolkata',
      date_format: updates.date_format || currentSettings.date_format || 'DD/MM/YYYY',
      week_start: updates.week_start || currentSettings.week_start || 'Monday',
      invoice_prefix: updates.invoice_prefix !== undefined ? updates.invoice_prefix : (currentSettings.invoice_prefix || 'INV'),
      invoice_number_format: updates.invoice_number_format || currentSettings.invoice_number_format || 'prefix_year_sequence',
      invoice_separator: updates.invoice_separator !== undefined ? updates.invoice_separator : (currentSettings.invoice_separator ?? '-'),
      invoice_include_year: updates.invoice_include_year !== undefined ? updates.invoice_include_year : (currentSettings.invoice_include_year ?? true),
      invoice_padding: updates.invoice_padding !== undefined ? updates.invoice_padding : (currentSettings.invoice_padding ?? 4),
      invoice_next_sequence: updates.invoice_next_sequence !== undefined ? updates.invoice_next_sequence : (currentSettings.invoice_next_sequence ?? 1),
      invoice_annual_reset: updates.invoice_annual_reset !== undefined ? updates.invoice_annual_reset : (currentSettings.invoice_annual_reset ?? false),
      default_tax_rate: updates.default_tax_rate !== undefined ? updates.default_tax_rate : (currentSettings.default_tax_rate ?? 0),
      tax_name: updates.tax_name !== undefined ? updates.tax_name : (currentSettings.tax_name || DEFAULT_USER_SETTINGS.tax_name || 'Tax'),
      default_payment_terms: updates.default_payment_terms !== undefined ? updates.default_payment_terms : (currentSettings.default_payment_terms ?? 14),
      email_notifications: updates.email_notifications !== undefined ? updates.email_notifications : (currentSettings.email_notifications ?? true),
      email_deliverables: updates.email_deliverables !== undefined ? updates.email_deliverables : (currentSettings.email_deliverables ?? true),
      email_documents: updates.email_documents !== undefined ? updates.email_documents : (currentSettings.email_documents ?? true),
      email_invoices: updates.email_invoices !== undefined ? updates.email_invoices : (currentSettings.email_invoices ?? true),
      email_invitations: updates.email_invitations !== undefined ? updates.email_invitations : (currentSettings.email_invitations ?? true),
      invoice_reminders: updates.invoice_reminders !== undefined ? updates.invoice_reminders : (currentSettings.invoice_reminders ?? true),
      comment_alerts: updates.comment_alerts !== undefined ? updates.comment_alerts : (currentSettings.comment_alerts ?? true),
      weekly_digest: updates.weekly_digest !== undefined ? updates.weekly_digest : (currentSettings.weekly_digest ?? false),
      default_deliverable_niche: updates.default_deliverable_niche || currentSettings.default_deliverable_niche || 'software_development',
      payment_settings: effectivePaymentSettings,
      upi_id: upiId,
      upi_qr_code_url: upiQrCodeUrl,
      bank_name: bankName,
      account_holder_name: accountHolderName,
      account_number: accountNumber,
      ifsc_code: ifscCode,
      branch_name: branchName,
      razorpay_payment_link: razorpayPaymentLink,
    };

    // Always cache locally under targetUserId and usr-default immediately
    this.setLocalSettings(targetUserId, mergedSettings);
    this.setPaymentSettings(targetUserId, effectivePaymentSettings);
    if (targetUserId !== 'usr-default') {
      this.setLocalSettings('usr-default', mergedSettings);
      this.setPaymentSettings('usr-default', effectivePaymentSettings);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('flowdesk:settings-updated', { detail: mergedSettings }));
    }

    if (typeof window !== 'undefined' && isServerMutationBatchEnabled(4)) {
      if (userId && userId !== 'usr-default' && !userId.startsWith('usr-demo')) {
        try {
          await fetch('/api/account/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currency: updates.currency,
              timezone: updates.timezone,
              dateFormat: updates.date_format,
              invoicePrefix: updates.invoice_prefix,
              invoiceNumberFormat: updates.invoice_number_format,
              invoiceSeparator: updates.invoice_separator,
              invoiceIncludeYear: updates.invoice_include_year,
              invoicePadding: updates.invoice_padding,
              defaultTaxRate: updates.default_tax_rate,
              taxName: updates.tax_name,
              defaultPaymentTerms: updates.default_payment_terms,
              defaultDeliverableNiche: updates.default_deliverable_niche,
              paymentSettings: effectivePaymentSettings,
              upiId,
              upiQrCodeUrl,
              bankName,
              accountHolderName,
              accountNumber,
              ifscCode,
              branchName,
              razorpayPaymentLink,
            }),
          });
          if (
            updates.email_notifications !== undefined ||
            updates.email_deliverables !== undefined ||
            updates.email_documents !== undefined ||
            updates.email_invoices !== undefined ||
            updates.email_invitations !== undefined ||
            updates.invoice_reminders !== undefined ||
            updates.comment_alerts !== undefined ||
            updates.weekly_digest !== undefined
          ) {
            await fetch('/api/account/notifications', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                emailNotifications: updates.email_notifications,
                emailDeliverables: updates.email_deliverables,
                emailDocuments: updates.email_documents,
                emailInvoices: updates.email_invoices,
                emailInvitations: updates.email_invitations,
                invoiceReminders: updates.invoice_reminders,
                commentAlerts: updates.comment_alerts,
                weeklyDigest: updates.weekly_digest,
              }),
            });
          }
        } catch (err) {
          console.warn('Server settings sync notice:', err);
        }
      }
    }

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
        if (updates.email_invitations !== undefined) payload.email_invitations = updates.email_invitations;
        if (updates.invoice_reminders !== undefined) payload.invoice_reminders = updates.invoice_reminders;
        if (updates.weekly_digest !== undefined) payload.weekly_digest = updates.weekly_digest;

        // Try upserting full payload first with payment columns if schema supports it
        const fullPayload = {
          ...payload,
          payment_settings: effectivePaymentSettings,
          upi_id: upiId,
          upi_qr_code_url: upiQrCodeUrl,
          bank_name: bankName,
          account_holder_name: accountHolderName,
          account_number: accountNumber,
          ifsc_code: ifscCode,
          branch_name: branchName,
          razorpay_payment_link: razorpayPaymentLink,
        };

        let { error } = await supabase.from('user_settings').upsert(fullPayload, { onConflict: 'id' });
        if (error) {
          // Fall back to clean core schema columns guaranteed to exist
          delete payload.default_deliverable_niche;
          delete payload.email_invitations;
          delete payload.payment_settings;
          delete payload.upi_id;
          delete payload.upi_qr_code_url;
          delete payload.bank_name;
          delete payload.account_holder_name;
          delete payload.account_number;
          delete payload.ifsc_code;
          delete payload.branch_name;
          delete payload.razorpay_payment_link;
          const retry = await supabase.from('user_settings').upsert(payload, { onConflict: 'id' });
          if (retry.error) {
            console.warn('Supabase core settings upsert error:', retry.error.message);
          }
        }

        if (updates.currency) {
          try {
            await supabase
              .from('profiles')
              .update({ currency: updates.currency, updated_at: new Date().toISOString() })
              .eq('id', userId);
          } catch (profSyncErr) {
            console.warn('Profile currency update notice:', profSyncErr);
          }
        }
      } catch (err: any) {
        console.warn('Supabase settings sync notice (saved to local cache):', err?.message);
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
   * Get dedicated payment settings from localStorage
   */
  getPaymentSettings(userId: string): Partial<FreelancerPaymentSettings> | null {
    if (typeof window === 'undefined') return null;
    if (!userId) return null;
    try {
      const key = `${LOCAL_PAYMENT_PREFIX}${userId}`;
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
   * Save dedicated payment settings to localStorage
   */
  setPaymentSettings(userId: string, paymentSettings: Partial<FreelancerPaymentSettings>): void {
    if (typeof window === 'undefined') return;
    if (!userId) return;
    try {
      const key = `${LOCAL_PAYMENT_PREFIX}${userId}`;
      localStorage.setItem(key, JSON.stringify(paymentSettings));
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
          email_deliverables: DEFAULT_USER_SETTINGS.email_deliverables,
          email_documents: DEFAULT_USER_SETTINGS.email_documents,
          email_invoices: DEFAULT_USER_SETTINGS.email_invoices,
          email_invitations: DEFAULT_USER_SETTINGS.email_invitations,
          invoice_reminders: DEFAULT_USER_SETTINGS.invoice_reminders,
          comment_alerts: DEFAULT_USER_SETTINGS.comment_alerts,
          weekly_digest: DEFAULT_USER_SETTINGS.weekly_digest,
          updated_at: new Date().toISOString(),
        };

        let { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'id' });
        if (error && error.message?.includes('email_invitations')) {
          delete payload.email_invitations;
          const retry = await supabase.from('user_settings').upsert(payload, { onConflict: 'id' });
          error = retry.error;
        }
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
