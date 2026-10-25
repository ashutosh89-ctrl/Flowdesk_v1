import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Input } from '@/frontend/shared/ui/input';
import { Modal } from '@/frontend/shared/ui/modal';
import { SettingsService, FreelancerWorkspaceService } from '@/backend/freelancer';
import { UserSettingsService, DEFAULT_USER_SETTINGS } from '@/backend/auth/user-settings-service';
import { AuthService } from '@/backend/auth/auth-service';
import { AccountDeletionService } from '@/backend/auth/account-deletion-service';
import { useAuth } from '@/frontend/auth/auth-context';
import { UserProfile, UserSettings } from '@/shared/types';
import { StorageHelper } from '@/backend/storage/storage-helper';
import { updateWorkspaceBranding } from '@/backend/utilities/workspace';
import { supabase } from '@/backend/utilities/supabase';
import {
  User,
  DollarSign,
  Bell,
  Shield,
  Save,
  Loader2,
  Sparkles,
  Mail,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
  Clock,
  Upload,
  Image as ImageIcon,
  PenTool,
  Trash2,
  Hash,
  Layers,
  LogOut,
  RefreshCw,
  Link2,
  UserPlus,
  Code2,
  Briefcase,
  CreditCard,
  Building2,
  QrCode,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';
import { SUPPORTED_CURRENCIES } from '@/shared/utils/currency';
import { formatInvoiceNumber, sanitizeInvoicePrefix } from '@/shared/utils/invoice-calculations';
import { InvoiceNumberFormatPreset } from '@/shared/types';
import { isApprovedRazorpayUrl } from '@/shared/utils/safe-url';
import { QRCode } from '@/frontend/shared/ui/qr-code';

import { CountrySelect } from '@/frontend/shared/ui/country-select';
import { PhoneInput } from '@/frontend/shared/ui/phone-input';
import { switchCountryPrefix } from '@/shared/utils/countries';
import { BillingPlanPanel } from './billing-plan-panel';
import { AutomationsPanel } from './automations-panel';
import { PortalSettingsPanel } from './portal-settings-panel';

type SettingsTab = 'profile' | 'portal' | 'billing' | 'automations' | 'notifications' | 'security';

export const SettingsView: React.FC = () => {
  const { user, profile: authProfile, refreshProfile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  // Fail-closed: no mock identity fallback in production. The authenticated
  // profile (or an empty shell that the user fills in) is the only source.
  const [profile, setProfile] = useState<UserProfile>(() => authProfile || {
    id: '',
    name: '',
    title: '',
    email: '',
    avatarUrl: '',
    currency: 'USD',
    companyName: '',
    hourlyRate: 120,
    profession: '',
    country: 'India',
    timezone: 'Asia/Kolkata',
    language: 'English',
    onboardingCompleted: false,
  });
  const [settings, setSettings] = useState<UserSettings>(() => DEFAULT_USER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isResetPasswordSending, setIsResetPasswordSending] = useState(false);
  const [isDangerModalOpen, setIsDangerModalOpen] = useState(false);
  const [dangerConfirmText, setDangerConfirmText] = useState('');
  const [isChangeEmailModalOpen, setIsChangeEmailModalOpen] = useState(false);
  const [newLoginEmail, setNewLoginEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Logo, Signature & QR upload states
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [isUploadingQr, setIsUploadingQr] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const qrCodeInputRef = useRef<HTMLInputElement>(null);
  const [emailHealth, setEmailHealth] = useState<{
    status: string;
    details?: string;
    loading: boolean;
  }>({ status: 'checking', loading: true });

  const { showToast } = useToast();

  useEffect(() => {
    let mounted = true;
    fetch('/api/email/health')
      .then((res) => res.json())
      .then((data) => {
        if (mounted) {
          setEmailHealth({
            status: data.status || (data.success ? 'ready' : 'unconfigured'),
            details: data.details,
            loading: false,
          });
        }
      })
      .catch(() => {
        if (mounted) {
          setEmailHealth({
            status: 'transient_error',
            details: 'Could not connect to health endpoint',
            loading: false,
          });
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [profileData, settingsData] = await Promise.all([
          SettingsService.getUserProfile(user?.id),
          UserSettingsService.getUserSettings(user?.id || 'usr-default'),
        ]);

        if (mounted) {
          if (profileData) {
            setProfile(profileData);
          }
          if (settingsData) {
            setSettings(settingsData);
          }
        }
      } catch (err) {
        console.warn('Notice loading settings:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const handleProfileChange = (field: keyof UserProfile, value: any) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSettingsChange = (field: keyof UserSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
    if (field === 'default_deliverable_niche' && user?.id) {
      UserSettingsService.saveUserSettings(user.id, { [field]: value }).catch((err) => {
        console.warn('Background niche preference sync notice:', err);
      });
    }
  };

  const uploadBrandingAsset = async (file: File, type: 'logo' | 'signature' | 'qr'): Promise<string> => {
    let wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
    if (!wsId && user?.id) {
      const { getCurrentWorkspace } = await import('@/backend/utilities/workspace');
      const ws = await getCurrentWorkspace();
      wsId = ws?.id || null;
    }

    // 1. Attempt upload via server API route (bypasses RLS with service role if available)
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      if (wsId) formData.append('workspaceId', wsId);
      if (user?.id) formData.append('userId', user.id);

      const response = await fetch('/api/settings/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        if (result?.url) {
          return result.url;
        }
      }
    } catch (apiErr) {
      console.warn(`[SettingsView] Server upload route attempt failed, falling back to client storage:`, apiErr);
    }

    // 2. Direct StorageHelper upload fallback (uses client session)
    const effectiveWsId = wsId || user?.id;
    if (!effectiveWsId) {
      throw new Error('Could not identify active workspace or account. Please try reloading the page.');
    }

    const bucket = type === 'signature' ? 'signatures' : 'logos';
    const res = await StorageHelper.uploadFile(bucket, effectiveWsId, 'branding', file);
    if (res.url) {
      return res.url;
    }

    throw new Error(res.error || `Could not upload ${type} to storage.`);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    try {
      const url = await uploadBrandingAsset(file, 'logo');
      handleProfileChange('logoUrl', url);
      showToast('Logo Uploaded', 'Studio logo has been updated and linked to profile.', 'success');
    } catch (err) {
      showToast('Upload Failed', err instanceof Error ? err.message : 'Logo upload failed.', 'error');
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingSignature(true);
    try {
      const url = await uploadBrandingAsset(file, 'signature');
      handleProfileChange('signatureUrl', url);
      showToast('Signature Uploaded', 'Authorized signature updated for invoice PDFs.', 'success');
    } catch (err) {
      showToast('Upload Failed', err instanceof Error ? err.message : 'Signature upload failed.', 'error');
    } finally {
      setIsUploadingSignature(false);
      if (signatureInputRef.current) signatureInputRef.current.value = '';
    }
  };

  const handleQrCodeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingQr(true);
    try {
      const url = await uploadBrandingAsset(file, 'qr');
      handleSettingsChange('upi_qr_code_url', url);
      handleProfileChange('upiQrCodeUrl', url);
      setSettings((prev) => ({
        ...prev,
        upi_qr_code_url: url,
        payment_settings: {
          ...prev.payment_settings,
          upiQrCodeUrl: url,
          upiEnabled: true,
        },
      }));
      setProfile((prev) => ({
        ...prev,
        upiQrCodeUrl: url,
      }));
      setDirty(true);
      showToast('QR Code Uploaded', 'Custom payment QR has been saved and will appear on invoices.', 'success');
    } catch (err) {
      showToast('Upload Failed', err instanceof Error ? err.message : 'QR code upload failed.', 'error');
    } finally {
      setIsUploadingQr(false);
      if (qrCodeInputRef.current) qrCodeInputRef.current.value = '';
    }
  };

  const handleRemoveQrCode = () => {
    handleSettingsChange('upi_qr_code_url', '');
    handleProfileChange('upiQrCodeUrl', '');
    setSettings((prev) => ({
      ...prev,
      upi_qr_code_url: '',
      payment_settings: {
        ...prev.payment_settings,
        upiQrCodeUrl: '',
      },
    }));
    setProfile((prev) => ({
      ...prev,
      upiQrCodeUrl: '',
    }));
    setDirty(true);
    showToast('QR Code Removed', 'Reverted to dynamic UPI QR code generator.', 'info');
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);

    try {
      // 1. Save profile — block if identity fields are empty (fail-closed shell)
      if (!user?.id) {
        throw new Error('You must be signed in to save your profile.');
      }
      if (!profile.name?.trim() || !profile.email?.trim()) {
        throw new Error('Name and email are required before saving your profile.');
      }
      await SettingsService.updateUserProfile(
        {
          name: profile.name,
          title: profile.title,
          email: profile.email,
          companyName: profile.companyName,
          hourlyRate: profile.hourlyRate,
          currency: profile.currency,
          phone: profile.phone,
          country: profile.country,
          avatarUrl: profile.avatarUrl,
          logoUrl: profile.logoUrl,
          signatureUrl: profile.signatureUrl,
          upiQrCodeUrl: settings.upi_qr_code_url || profile.upiQrCodeUrl || settings.payment_settings?.upiQrCodeUrl,
          upiId: settings.upi_id || profile.upiId || settings.payment_settings?.upiId,
        },
        user?.id
      );

      // 2. Sync workspace branding and currency in parallel
      const wsId = await FreelancerWorkspaceService.getActiveWorkspaceId();
      if (wsId) {
        try {
          await updateWorkspaceBranding(wsId, {
            name: profile.companyName,
            logoUrl: profile.logoUrl,
            signatureUrl: profile.signatureUrl,
            currency: profile.currency,
          });

          // Propagate studio currency to clients in this workspace so new and existing client operations stay in sync
          const { supabase } = await import('@/backend/utilities/supabase');
          await supabase
            .from('clients')
            .update({ currency: profile.currency, updated_at: new Date().toISOString() })
            .eq('workspace_id', wsId);
        } catch (clientSyncErr) {
          console.warn('Workspace client currency sync notice:', clientSyncErr);
        }
      }

      // 3. Save user settings (tax, currency, prefix, terms, notifications)
      try {
        await UserSettingsService.saveUserSettings(user?.id || 'usr-default', {
          currency: profile.currency,
          default_tax_rate: settings.default_tax_rate,
          tax_name: settings.tax_name,
          invoice_prefix: settings.invoice_prefix,
          default_payment_terms: settings.default_payment_terms,
          email_notifications: settings.email_notifications,
          email_deliverables: settings.email_deliverables,
          email_documents: settings.email_documents,
          email_invoices: settings.email_invoices,
          email_invitations: settings.email_invitations,
          invoice_reminders: settings.invoice_reminders,
          comment_alerts: settings.comment_alerts,
          weekly_digest: settings.weekly_digest,
          default_deliverable_niche: settings.default_deliverable_niche,
          payment_settings: {
            bankTransferEnabled: settings.payment_settings?.bankTransferEnabled ?? true,
            upiEnabled: settings.payment_settings?.upiEnabled ?? false,
            razorpayLinkEnabled: settings.payment_settings?.razorpayLinkEnabled ?? false,
            upiId: settings.upi_id || settings.payment_settings?.upiId || '',
            upiQrCodeUrl: settings.upi_qr_code_url || settings.payment_settings?.upiQrCodeUrl || '',
            bankDetails: {
              accountHolderName: settings.account_holder_name || settings.payment_settings?.bankDetails?.accountHolderName || '',
              bankName: settings.bank_name || settings.payment_settings?.bankDetails?.bankName || '',
              accountNumber: settings.account_number || settings.payment_settings?.bankDetails?.accountNumber || '',
              ifscCode: settings.ifsc_code || settings.payment_settings?.bankDetails?.ifscCode || '',
              branchName: settings.branch_name || settings.payment_settings?.bankDetails?.branchName || '',
              upiId: settings.upi_id || settings.payment_settings?.bankDetails?.upiId || '',
            },
            razorpayPaymentLink: settings.razorpay_payment_link || settings.payment_settings?.razorpayPaymentLink || '',
            defaultPaymentInstructions: settings.payment_settings?.defaultPaymentInstructions || '',
          },
          upi_id: settings.upi_id,
          upi_qr_code_url: settings.upi_qr_code_url,
          bank_name: settings.bank_name,
          account_holder_name: settings.account_holder_name,
          account_number: settings.account_number,
          ifsc_code: settings.ifsc_code,
          branch_name: settings.branch_name,
          razorpay_payment_link: settings.razorpay_payment_link,
        });
      } catch (settingsErr) {
        console.warn('UserSettingsService.saveUserSettings notice:', settingsErr);
      }

      // 4. Refresh profile context across app shell
      if (refreshProfile) {
        await refreshProfile();
      }

      setDirty(false);
      showToast('Settings Saved', 'Studio profile, branding, and alert preferences updated successfully.', 'success');
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err) ? String(err.message) : 'Failed to save settings.';
      showToast('Error', msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    const targetEmail = user?.email || profile.email;
    if (!targetEmail) {
      showToast('Error', 'No account email found to send reset instructions.', 'error');
      return;
    }

    setIsResetPasswordSending(true);
    try {
      const res = await AuthService.forgotPassword(targetEmail);
      if (!res.error) {
        showToast('Password Reset Dispatched', `A secure reset link was sent to ${targetEmail}`, 'success');
      } else {
        showToast('Password Reset Notice', res.error || 'Check your inbox for reset instructions.', 'info');
      }
    } catch {
      showToast('Notice', 'Password reset instructions have been triggered.', 'info');
    } finally {
      setIsResetPasswordSending(false);
    }
  };

  const handleChangeLoginEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoginEmail || !newLoginEmail.includes('@')) {
      showToast('Invalid Email', 'Please enter a valid email address.', 'error');
      return;
    }

    setIsChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newLoginEmail });
      if (error) {
        showToast('Error', error.message, 'error');
      } else {
        // Profile email consistency: once the change is CONFIRMED
        // (via the email link), Supabase Auth email becomes authoritative.
        // Sync profiles.email optimistically now; if confirmation never happens,
        // Supabase leaves auth email unchanged and the next verified login
        // re-syncs profiles.email from auth.users.email (source of truth).
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            await supabase
              .from('profiles')
              .update({ email: newLoginEmail, updated_at: new Date().toISOString() })
              .eq('id', user.id);
          }
        } catch (syncErr) {
          console.warn('Profile email sync notice:', syncErr);
          // Non-fatal: auth email change succeeded; profile sync retried on next login.
        }

        showToast(
          'Confirmation Email Sent',
          `A verification link has been sent to ${newLoginEmail}. Please confirm to complete email change.`,
          'success'
        );
        setIsChangeEmailModalOpen(false);
        setNewLoginEmail('');
      }
    } catch (err) {
      showToast('Notice', 'Could not dispatch email change request.', 'info');
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleResetWorkspace = async () => {
    if (dangerConfirmText.trim().toUpperCase() !== 'RESET') {
      showToast('Confirmation Required', 'Please type RESET to confirm workspace reset.', 'error');
      return;
    }

    try {
      await UserSettingsService.resetUserSettings(user?.id || 'usr-default');
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`flowdesk_user_profile_${user?.id || 'usr-default'}`);
      }

      setIsDangerModalOpen(false);
      setDangerConfirmText('');
      showToast('Workspace Reset', 'Studio preferences and local cache reverted to original defaults.', 'info');
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err) {
      showToast('Error', 'Failed to reset settings in database.', 'error');
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      showToast('Signed Out', 'You have been safely signed out of your workspace.', 'info');
      setTimeout(() => {
        window.location.href = '/login';
      }, 300);
    } catch {
      window.location.href = '/login';
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteFreelancerAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      showToast('Confirmation Required', 'Please type DELETE to confirm account deletion.', 'error');
      return;
    }

    if (!user?.id) {
      showToast('Error', 'User ID not found.', 'error');
      return;
    }

    setIsDeletingAccount(true);
    try {
      const res = await AccountDeletionService.deleteFreelancerAccount(user.id);
      if (res.success) {
        setIsDeleteAccountModalOpen(false);
        setDeleteConfirmText('');
        showToast(
          'Account Deletion Initiated',
          'Your account is now scheduled for deletion. You have a 5-day grace period to restore it by logging in.',
          'info'
        );
        await signOut();
        setTimeout(() => {
          window.location.href = '/login?deleted=5days';
        }, 1200);
      } else {
        showToast('Error', res.error || 'Failed to initiate account deletion.', 'error');
      }
    } catch (err: any) {
      showToast('Error', err.message || 'An error occurred while deleting account.', 'error');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto" />
          <p className="text-xs text-zinc-400 font-mono">Loading studio preferences & defaults...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="pb-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Settings & Preferences</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Configure studio branding, hourly rates, invoices, and workspace alerts.
          </p>
        </div>

        {dirty && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={saving}
            onClick={() => handleSave()}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Changes
          </Button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-white/10 gap-1 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'profile'
              ? 'bg-white/10 text-white shadow-sm border border-white/15'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <User className="w-4 h-4 text-emerald-400" />
          <span>Studio Profile & Branding</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('portal')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'portal'
              ? 'bg-white/10 text-white shadow-sm border border-white/15'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Link2 className="w-4 h-4 text-emerald-400" />
          <span>Client Portal & Link</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'billing'
              ? 'bg-white/10 text-white shadow-sm border border-white/15'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span>Rates & Invoicing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('automations')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'automations'
              ? 'bg-white/10 text-white shadow-sm border border-white/15'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <RefreshCw className="w-4 h-4 text-cyan-400" />
          <span>Automations & Jobs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'notifications'
              ? 'bg-white/10 text-white shadow-sm border border-white/15'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Bell className="w-4 h-4 text-amber-400" />
          <span>Notifications & Alerts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'security'
              ? 'bg-white/10 text-white shadow-sm border border-white/15'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Shield className="w-4 h-4 text-cyan-400" />
          <span>Security & Danger Zone</span>
        </button>
      </div>

      {/* TAB: PERMANENT CLIENT PORTAL LINK */}
      {activeTab === 'portal' && <PortalSettingsPanel />}

      <form onSubmit={handleSave} className="space-y-6">
        {/* TAB 1: STUDIO PROFILE & BRANDING */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <Card variant="crystal">
              <CardHeader>
                <CardTitle>Studio Profile</CardTitle>
                <CardDescription>Information displayed on client portals, deliverables, and invoice headers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    value={profile.name}
                    onChange={(e) => handleProfileChange('name', e.target.value)}
                    required
                  />
                  <Input
                    label="Professional Title"
                    value={profile.title}
                    onChange={(e) => handleProfileChange('title', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Contact / Invoicing Email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => handleProfileChange('email', e.target.value)}
                    required
                  />
                  <Input
                    label="Company / Studio Name"
                    value={profile.companyName}
                    onChange={(e) => handleProfileChange('companyName', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <PhoneInput
                    label="Phone Number"
                    value={profile.phone || ''}
                    country={profile.country || 'India'}
                    onChange={(newPhone) => handleProfileChange('phone', newPhone)}
                  />
                  <CountrySelect
                    label="Country / Region"
                    value={profile.country || 'India'}
                    onChange={(newCountry) => {
                      const updatedPhone = switchCountryPrefix(profile.phone || '', profile.country || 'India', newCountry);
                      setProfile((prev) => ({
                        ...prev,
                        country: newCountry,
                        phone: updatedPhone,
                      }));
                      setDirty(true);
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Studio Branding & PDF Customization */}
            <Card variant="crystal">
              <CardHeader>
                <CardTitle>Studio Branding & PDF Identity</CardTitle>
                <CardDescription>Upload your studio logo and signature to be embedded automatically in PDF invoices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Studio Logo Upload */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Studio Logo</span>
                      </div>
                      {profile.logoUrl && (
                        <button
                          type="button"
                          onClick={() => handleProfileChange('logoUrl', '')}
                          className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-400">
                      Displayed on the top header of invoice statements and generated PDFs (PNG or JPG).
                    </p>

                    {profile.logoUrl ? (
                      <div className="h-24 w-full bg-zinc-950/80 rounded-lg border border-white/10 flex items-center justify-center p-2 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={profile.logoUrl}
                          alt="Studio Logo"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-24 w-full bg-zinc-950/40 rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500 text-xs">
                        <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
                        <span>No logo uploaded</span>
                      </div>
                    )}

                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      isLoading={isUploadingLogo}
                      onClick={() => logoInputRef.current?.click()}
                      className="w-full text-xs"
                      leftIcon={<Upload className="w-3.5 h-3.5 text-emerald-400" />}
                    >
                      {profile.logoUrl ? 'Replace Studio Logo' : 'Upload Studio Logo'}
                    </Button>
                  </div>

                  {/* Authorized Signature Upload */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Authorized Signature</span>
                      </div>
                      {profile.signatureUrl && (
                        <button
                          type="button"
                          onClick={() => handleProfileChange('signatureUrl', '')}
                          className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-400">
                      Rendered on the footer of invoice PDFs above the Authorized Signature line.
                    </p>

                    {profile.signatureUrl ? (
                      <div className="h-24 w-full bg-zinc-950/80 rounded-lg border border-white/10 flex items-center justify-center p-2 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={profile.signatureUrl}
                          alt="Authorized Signature"
                          className="max-h-full max-w-full object-contain filter invert opacity-90"
                        />
                      </div>
                    ) : (
                      <div className="h-24 w-full bg-zinc-950/40 rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center text-zinc-500 text-xs">
                        <PenTool className="w-6 h-6 mb-1 opacity-50" />
                        <span>No signature uploaded</span>
                      </div>
                    )}

                    <input
                      ref={signatureInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      isLoading={isUploadingSignature}
                      onClick={() => signatureInputRef.current?.click()}
                      className="w-full text-xs"
                      leftIcon={<Upload className="w-3.5 h-3.5 text-cyan-400" />}
                    >
                      {profile.signatureUrl ? 'Replace Signature' : 'Upload Signature'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deliverable Workflow Preferences */}
            <Card variant="crystal">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#2563EB]" />
                  <CardTitle>Deliverable Preferences</CardTitle>
                </div>
                <CardDescription>
                  Choose the default workflow for creating deliverables. You can change this preference at any time.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Software Developer Option */}
                  <button
                    type="button"
                    onClick={() => handleSettingsChange('default_deliverable_niche', 'software_development')}
                    className={`relative p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                      (settings.default_deliverable_niche || 'software_development') === 'software_development'
                        ? 'bg-[#2563EB]/10 border-[#2563EB] shadow-[0_0_15px_rgba(37,99,235,0.15)] ring-1 ring-[#2563EB]/50'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-lg ${
                            (settings.default_deliverable_niche || 'software_development') === 'software_development'
                              ? 'bg-[#2563EB]/20 text-[#60A5FA]'
                              : 'bg-white/5 text-zinc-400'
                          }`}>
                            <Code2 className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-semibold text-white">Software Developer</span>
                        </div>
                        {(settings.default_deliverable_niche || 'software_development') === 'software_development' && (
                          <CheckCircle2 className="w-4 h-4 text-[#60A5FA]" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                        Preselects technical deliverable workflow with repository URL, branch, pull request, and deployment preview fields.
                      </p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                      <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Default: Code & Tech</span>
                    </div>
                  </button>

                  {/* Others Option */}
                  <button
                    type="button"
                    onClick={() => handleSettingsChange('default_deliverable_niche', 'others')}
                    className={`relative p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                      settings.default_deliverable_niche === 'others'
                        ? 'bg-[#2563EB]/10 border-[#2563EB] shadow-[0_0_15px_rgba(37,99,235,0.15)] ring-1 ring-[#2563EB]/50'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-lg ${
                            settings.default_deliverable_niche === 'others'
                              ? 'bg-[#2563EB]/20 text-[#60A5FA]'
                              : 'bg-white/5 text-zinc-400'
                          }`}>
                            <Briefcase className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-semibold text-white">Others</span>
                        </div>
                        {settings.default_deliverable_niche === 'others' && (
                          <CheckCircle2 className="w-4 h-4 text-[#60A5FA]" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                        Preselects general-purpose deliverable workflow for design, video editing, copywriting, marketing, consulting, and other creative services.
                      </p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                      <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Default: General & Creative</span>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: RATES & INVOICE DEFAULTS + NUMBERING SYSTEM */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <BillingPlanPanel />

            {/* Rates & Financial Defaults */}
            <Card variant="crystal">
              <CardHeader>
                <CardTitle>Rates & Financial Defaults</CardTitle>
                <CardDescription>Default currency, tax rates, and standard payment terms for new invoices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="Default Hourly Rate"
                    type="number"
                    value={profile.hourlyRate}
                    onChange={(e) => handleProfileChange('hourlyRate', parseFloat(e.target.value) || 0)}
                    required
                  />
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Primary Studio Currency</label>
                    <select
                      value={profile.currency}
                      onChange={(e) => handleProfileChange('currency', e.target.value)}
                      className="w-full px-3 py-2 border border-white/10 rounded-xl bg-zinc-900 text-white text-sm focus:outline-none focus:border-white/30"
                    >
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code} className="bg-zinc-900 text-white">
                          {c.name} ({c.symbol})
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Default Tax Rate (%)"
                    type="number"
                    min="0"
                    max="100"
                    value={settings.default_tax_rate}
                    onChange={(e) => handleSettingsChange('default_tax_rate', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Tax Label"
                    value={settings.tax_name}
                    onChange={(e) => handleSettingsChange('tax_name', e.target.value)}
                    placeholder="e.g. GST, VAT, Sales Tax"
                  />
                  <Input
                    label="Payment Due Terms (Days)"
                    type="number"
                    min="0"
                    value={settings.default_payment_terms}
                    onChange={(e) => handleSettingsChange('default_payment_terms', parseInt(e.target.value) || 14)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Invoice & Bill Numbering System */}
            <Card variant="crystal">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Hash className="w-5 h-5 text-emerald-400" />
                      <CardTitle>Invoice & Bill Numbering</CardTitle>
                    </div>
                    <CardDescription className="mt-1">
                      Configure your automated invoice numbering format. Invoices generated in the builder will strictly adhere to this rule.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Live Number Preview Card */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-zinc-900/60 to-emerald-950/20 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase text-emerald-400 font-bold tracking-wider">
                      Next Generated Invoice Preview
                    </span>
                    <div className="text-2xl font-mono font-extrabold text-white tracking-wider">
                      {formatInvoiceNumber(
                        {
                          format: settings.invoice_number_format || 'prefix_year_sequence',
                          prefix: settings.invoice_prefix ?? 'INV',
                          separator: settings.invoice_separator ?? '-',
                          includeYear: settings.invoice_include_year ?? true,
                          padding: settings.invoice_padding || 4,
                          nextSequence: settings.invoice_next_sequence || 1,
                        },
                        settings.invoice_next_sequence || 1
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      Sequential, immutable, and collision-free. Existing historical invoices will not be renamed.
                    </p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono font-bold shrink-0 self-start sm:self-center">
                    Auto-Applied on Create
                  </div>
                </div>

                {/* Preset Selector */}
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-2">
                    Numbering Format Template
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { id: 'prefix_year_sequence' as InvoiceNumberFormatPreset, label: 'INV-2026-0001', desc: 'Prefix + Year + Sequence' },
                      { id: 'prefix_sequence' as InvoiceNumberFormatPreset, label: 'INV-0001', desc: 'Prefix + Sequence' },
                      { id: 'bill_year_sequence' as InvoiceNumberFormatPreset, label: 'BILL-2026-0001', desc: 'Bill + Year + Sequence' },
                      { id: 'bill_sequence' as InvoiceNumberFormatPreset, label: 'BILL-0001', desc: 'Bill + Sequence' },
                      { id: 'year_sequence' as InvoiceNumberFormatPreset, label: '2026-0001', desc: 'Year + Sequence' },
                      { id: 'custom' as InvoiceNumberFormatPreset, label: 'Custom Format', desc: 'Full custom control' },
                    ].map((preset) => {
                      const isSelected = (settings.invoice_number_format || 'prefix_year_sequence') === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            if (preset.id === 'prefix_year_sequence') {
                              handleSettingsChange('invoice_number_format', 'prefix_year_sequence');
                              handleSettingsChange('invoice_prefix', 'INV');
                              handleSettingsChange('invoice_include_year', true);
                              handleSettingsChange('invoice_separator', '-');
                              handleSettingsChange('invoice_padding', 4);
                            } else if (preset.id === 'prefix_sequence') {
                              handleSettingsChange('invoice_number_format', 'prefix_sequence');
                              handleSettingsChange('invoice_prefix', 'INV');
                              handleSettingsChange('invoice_include_year', false);
                              handleSettingsChange('invoice_separator', '-');
                              handleSettingsChange('invoice_padding', 4);
                            } else if (preset.id === 'bill_year_sequence') {
                              handleSettingsChange('invoice_number_format', 'bill_year_sequence');
                              handleSettingsChange('invoice_prefix', 'BILL');
                              handleSettingsChange('invoice_include_year', true);
                              handleSettingsChange('invoice_separator', '-');
                              handleSettingsChange('invoice_padding', 4);
                            } else if (preset.id === 'bill_sequence') {
                              handleSettingsChange('invoice_number_format', 'bill_sequence');
                              handleSettingsChange('invoice_prefix', 'BILL');
                              handleSettingsChange('invoice_include_year', false);
                              handleSettingsChange('invoice_separator', '-');
                              handleSettingsChange('invoice_padding', 4);
                            } else if (preset.id === 'year_sequence') {
                              handleSettingsChange('invoice_number_format', 'year_sequence');
                              handleSettingsChange('invoice_prefix', '');
                              handleSettingsChange('invoice_include_year', true);
                              handleSettingsChange('invoice_separator', '-');
                              handleSettingsChange('invoice_padding', 4);
                            } else {
                              handleSettingsChange('invoice_number_format', 'custom');
                            }
                          }}
                          className={`p-3.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-emerald-500/10 border-emerald-500/60 ring-1 ring-emerald-500/40 text-white'
                              : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-bold">{preset.label}</span>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <span className="text-[11px] text-zinc-400 block">{preset.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Configuration Fields */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Prefix Input */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Prefix
                      </label>
                      <input
                        type="text"
                        value={settings.invoice_prefix ?? 'INV'}
                        onChange={(e) => handleSettingsChange('invoice_prefix', sanitizeInvoicePrefix(e.target.value))}
                        maxLength={12}
                        placeholder="e.g. INV, BILL, FD"
                        className="w-full px-3 py-2 border border-white/10 rounded-xl bg-zinc-900 text-white font-mono text-xs uppercase focus:outline-none focus:border-white/30"
                      />
                    </div>

                    {/* Separator Input */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Separator
                      </label>
                      <select
                        value={settings.invoice_separator ?? '-'}
                        onChange={(e) => handleSettingsChange('invoice_separator', e.target.value)}
                        className="w-full px-3 py-2 border border-white/10 rounded-xl bg-zinc-900 text-white font-mono text-xs focus:outline-none focus:border-white/30"
                      >
                        <option value="-">Hyphen (-)</option>
                        <option value="/">Slash (/)</option>
                        <option value="_">Underscore (_)</option>
                        <option value="">None (Empty)</option>
                      </select>
                    </div>

                    {/* Digits / Padding */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Number Padding (Digits)
                      </label>
                      <select
                        value={settings.invoice_padding || 4}
                        onChange={(e) => handleSettingsChange('invoice_padding', parseInt(e.target.value, 10) || 4)}
                        className="w-full px-3 py-2 border border-white/10 rounded-xl bg-zinc-900 text-white font-mono text-xs focus:outline-none focus:border-white/30"
                      >
                        <option value={1}>1 digit (1)</option>
                        <option value={2}>2 digits (01)</option>
                        <option value={3}>3 digits (001)</option>
                        <option value={4}>4 digits (0001)</option>
                        <option value={5}>5 digits (00001)</option>
                      </select>
                    </div>

                    {/* Starting / Next Number */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Starting Number
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={999999}
                        value={settings.invoice_next_sequence || 1}
                        onChange={(e) => handleSettingsChange('invoice_next_sequence', Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full px-3 py-2 border border-white/10 rounded-xl bg-zinc-900 text-white font-mono text-xs focus:outline-none focus:border-white/30"
                      />
                    </div>
                  </div>

                  {/* Year Toggle */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold text-white">Include Calendar Year</span>
                      <p className="text-[11px] text-zinc-400">
                        Appends the current 4-digit year (e.g. {new Date().getFullYear()}) in the invoice sequence.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.invoice_include_year ?? true}
                        onChange={(e) => handleSettingsChange('invoice_include_year', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods & Payout Setup (Dual Payment Options) */}
            <Card variant="crystal">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-400" />
                      <CardTitle>Payment Methods & Client Payout Instructions</CardTitle>
                    </div>
                    <CardDescription className="mt-1">
                      Configure your direct payment methods (Bank Transfer, UPI) and your external Razorpay Payment Link. These will automatically populate on new invoices and client portals.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Method A: Manual Payment Instructions */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">Method A: Direct Bank Transfer</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Account Holder Name"
                      value={settings.account_holder_name || ''}
                      onChange={(e) => {
                        handleSettingsChange('account_holder_name', e.target.value);
                      }}
                      placeholder="e.g. Acme Studio LLC or John Doe"
                    />
                    <Input
                      label="Bank Name"
                      value={settings.bank_name || ''}
                      onChange={(e) => {
                        handleSettingsChange('bank_name', e.target.value);
                      }}
                      placeholder="e.g. HDFC Bank, Chase, Barclays"
                    />
                    <Input
                      label="Account Number / IBAN"
                      value={settings.account_number || ''}
                      onChange={(e) => {
                        handleSettingsChange('account_number', e.target.value);
                      }}
                      placeholder="e.g. 50100234567890"
                    />
                    <Input
                      label="IFSC / Routing / SWIFT Code"
                      value={settings.ifsc_code || ''}
                      onChange={(e) => {
                        handleSettingsChange('ifsc_code', e.target.value);
                      }}
                      placeholder="e.g. HDFC0001234 or CHASUS33"
                    />
                    <div className="sm:col-span-2">
                      <Input
                        label="Branch Name (Optional)"
                        value={settings.branch_name || ''}
                        onChange={(e) => {
                          handleSettingsChange('branch_name', e.target.value);
                        }}
                        placeholder="e.g. Indiranagar, Bangalore"
                      />
                    </div>
                  </div>
                </div>

                {/* UPI Direct Transfer & Custom QR Upload */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-semibold text-white">UPI Payment & Direct QR Upload</h3>
                    </div>
                    {settings.upi_qr_code_url ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Custom QR Active
                      </span>
                    ) : settings.upi_id ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        Dynamic QR Active
                      </span>
                    ) : null}
                  </div>

                  {/* Hidden file input for QR code */}
                  <input
                    type="file"
                    ref={qrCodeInputRef}
                    onChange={handleQrCodeUpload}
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-4">
                      <div>
                        <Input
                          label="UPI ID / VPA (Optional if uploading QR directly)"
                          value={settings.upi_id || ''}
                          onChange={(e) => {
                            handleSettingsChange('upi_id', e.target.value.trim());
                          }}
                          placeholder="e.g. studio@okaxis, yourname@upi"
                        />
                        <p className="text-xs text-zinc-400 mt-1">
                          Clients can copy this UPI address or scan your QR code directly from their invoice portal and PDF exports.
                        </p>
                      </div>

                      {/* Direct QR Upload Action Bar */}
                      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-white">Direct QR Code Upload</p>
                            <p className="text-[11px] text-zinc-400">
                              Upload a screenshot of your PhonePe, Google Pay, Paytm, or Bank QR code to use directly.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => qrCodeInputRef.current?.click()}
                            disabled={isUploadingQr}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-sm shrink-0"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{isUploadingQr ? 'Uploading...' : settings.upi_qr_code_url ? 'Replace QR' : 'Upload QR'}</span>
                          </button>
                        </div>

                        {settings.upi_qr_code_url && (
                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Custom QR image linked
                            </span>
                            <button
                              type="button"
                              onClick={handleRemoveQrCode}
                              className="text-[11px] text-zinc-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Remove / Use Dynamic QR</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* QR Code Preview Box */}
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col items-center justify-center text-center">
                      {settings.upi_qr_code_url ? (
                        <div className="space-y-2 flex flex-col items-center">
                          <div className="p-2 bg-white rounded-xl shadow-lg border border-zinc-200">
                            <QRCode
                              src={settings.upi_qr_code_url}
                              size={120}
                              alt="Uploaded Payment QR"
                            />
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                            Uploaded QR Preview
                          </span>
                        </div>
                      ) : settings.upi_id ? (
                        <div className="space-y-2 flex flex-col items-center">
                          <div className="p-2.5 bg-white rounded-xl shadow-lg border border-zinc-200">
                            <QRCode
                              value={`upi://pay?pa=${encodeURIComponent(settings.upi_id)}&pn=${encodeURIComponent(profile.companyName || profile.name || 'FlowDesk')}&cu=${encodeURIComponent(profile.currency || 'INR')}`}
                              size={110}
                              darkColor="#000000"
                              lightColor="#ffffff"
                            />
                          </div>
                          <span className="text-[10px] font-mono text-cyan-400 font-semibold uppercase tracking-wider">
                            Live Dynamic QR Preview
                          </span>
                        </div>
                      ) : (
                        <div className="py-6 text-center space-y-2">
                          <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-zinc-500">
                            <QrCode className="w-6 h-6" />
                          </div>
                          <p className="text-xs text-zinc-400 font-medium">No QR Configured</p>
                          <p className="text-[11px] text-zinc-500 max-w-[180px]">
                            Upload your payment QR image or enter a UPI ID to preview.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Method B: Razorpay Payment Link */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-cyan-400" />
                      <h3 className="text-sm font-semibold text-white">Method B: Freelancer Razorpay Payment Link</h3>
                    </div>
                    {settings.razorpay_payment_link && isApprovedRazorpayUrl(settings.razorpay_payment_link) && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Approved Razorpay Link
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Input
                      label="Your Razorpay Payment Page URL / Link"
                      value={settings.razorpay_payment_link || ''}
                      onChange={(e) => {
                        handleSettingsChange('razorpay_payment_link', e.target.value.trim());
                      }}
                      placeholder="e.g. https://rzp.io/l/your-link or https://pages.razorpay.com/your-page"
                    />

                    {settings.razorpay_payment_link && (
                      <div>
                        {isApprovedRazorpayUrl(settings.razorpay_payment_link) ? (
                          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-xs text-emerald-300">
                              Valid Razorpay URL detected. Clients will see a &quot;Pay Online&quot; button.
                            </span>
                            <a
                              href={settings.razorpay_payment_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 transition-colors shrink-0"
                            >
                              <span>Test Link</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                            Must be a valid HTTPS link hosted on an approved Razorpay domain (rzp.io, pages.razorpay.com, or razorpay.me).
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-cyan-200/90 space-y-1">
                      <p className="font-semibold text-cyan-300">Direct Freelancer Merchant Settlement</p>
                      <p className="text-cyan-200/80 leading-relaxed">
                        FlowDesk is not a payment collector or escrow service. Funds paid through this link settle directly into your personal or corporate Razorpay merchant account according to your own Razorpay settlement schedule. No API secret keys required.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Default Payment Instructions / Terms */}
                <div className="space-y-2 pt-4 border-t border-white/10">
                  <label className="block text-xs font-medium text-zinc-300">
                    Default Payment Instructions for Clients
                  </label>
                  <textarea
                    rows={3}
                    value={settings.payment_settings?.defaultPaymentInstructions || ''}
                    onChange={(e) => {
                      const updated = {
                        ...(settings.payment_settings || {}),
                        defaultPaymentInstructions: e.target.value,
                      };
                      handleSettingsChange('payment_settings', updated);
                    }}
                    placeholder="e.g. Please quote the invoice number in the transfer description. After transferring, click 'Notify Payment' in the client portal to alert our studio."
                    className="w-full px-3 py-2 border border-white/10 rounded-xl bg-zinc-900 text-white text-xs focus:outline-none focus:border-white/30 resize-none leading-relaxed"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB: AUTOMATIONS & BACKGROUND JOBS */}
        {activeTab === 'automations' && <AutomationsPanel />}

        {/* TAB 3: NOTIFICATIONS & EMAIL PREFERENCES */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            {/* Email Delivery Status */}
            <Card variant="crystal">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-emerald-400" />
                    <CardTitle>Transactional Email Delivery</CardTitle>
                  </div>
                  {emailHealth.loading ? (
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-white/10 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                      Checking Provider...
                    </span>
                  ) : emailHealth.status === 'ready' ? (
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Email Service Active
                    </span>
                  ) : emailHealth.status === 'suspended_or_disabled' ? (
                    <span
                      className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5"
                      title={emailHealth.details || 'Brevo sending platform suspended by compliance'}
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      Sending Platform Suspended by Provider
                    </span>
                  ) : emailHealth.status === 'kill_switch_active' ? (
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-amber-400" />
                      Email Kill-Switch Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-white/10 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-zinc-400" />
                      Email Sandbox / Standby
                    </span>
                  )}
                </div>
                <CardDescription>
                  Configure which transactional email events trigger delivery to you and your clients.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {emailHealth.status === 'suspended_or_disabled' && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-amber-300">Provider Account Action Required</p>
                      <p className="text-xs text-amber-200/80 leading-relaxed">
                        Brevo has placed the transactional sending relay into a disabled state following historical compliance review.
                        Direct outbound emails are paused to prevent silent drops. The account owner must contact Brevo support or verify their sending domain to reactivate the platform. Client invitation links can still be copied and shared directly.
                      </p>
                    </div>
                  </div>
                )}

                {/* Client Invitation Emails */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-semibold text-white">Client Invitation Emails</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Send transactional email invitations containing secure one-time onboarding links when adding new clients.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.email_invitations ?? true}
                      onChange={(e) => handleSettingsChange('email_invitations', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Deliverable Emails */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-white">Deliverable Approval & Revision Emails</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Send email notifications when deliverables are submitted for review, approved by clients, or when revisions are requested.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.email_deliverables ?? true}
                      onChange={(e) => handleSettingsChange('email_deliverables', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Document Upload Emails */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-semibold text-white">Document Intake Notifications</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Receive an instant email summary whenever a client uploads a document, brief, or required contract asset.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.email_documents ?? true}
                      onChange={(e) => handleSettingsChange('email_documents', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Invoice & Payment Emails */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-white">Invoice & Payment Receipts</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Email official invoice notifications to clients upon issue, payment confirmations, and automated receipt vouchers.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.email_invoices ?? true}
                      onChange={(e) => handleSettingsChange('email_invoices', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Security & Account Lifecycle Alerts (Always Active) */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-950/50 border border-white/10 opacity-90">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-white">Security & Account Lifecycle Alerts</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Always Enabled
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Password resets, account deletion grace period notices, and security alerts cannot be disabled for compliance.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-not-allowed">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600 opacity-60"></div>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* In-App Alerts & Workspace Preferences */}
            <Card variant="crystal">
              <CardHeader>
                <CardTitle>In-App Alerts & Dashboard Feeds</CardTitle>
                <CardDescription>Manage real-time in-app badges, dashboard alerts, and activity feed logging</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Workspace Notifications */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-white">In-App Banner Notifications</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Receive top-bar banner notifications on client approvals, document uploads, and milestone updates.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.email_notifications ?? true}
                      onChange={(e) => handleSettingsChange('email_notifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Invoice Reminders */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-white">Automated Overdue Tracking</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Flag approaching due dates automatically on the financial dashboard and highlight overdue statements.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.invoice_reminders ?? true}
                      onChange={(e) => handleSettingsChange('invoice_reminders', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Comment & Review Alerts */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-semibold text-white">Deliverable Review & Comment Badges</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Badge deliverable cards and sidebar items when clients leave feedback or request revisions.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.comment_alerts ?? true}
                      onChange={(e) => handleSettingsChange('comment_alerts', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Weekly Digest */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-semibold text-white">Weekly Revenue & Pipeline Digest</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Compute weekly revenue totals and completed milestone summaries on Monday morning dashboard.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.weekly_digest ?? false}
                      onChange={(e) => handleSettingsChange('weekly_digest', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 4: SECURITY & DANGER ZONE */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Account & Session Details */}
            <Card variant="crystal">
              <CardHeader>
                <CardTitle>Account & Authentication</CardTitle>
                <CardDescription>Security credentials and authentication state</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono text-zinc-400 uppercase">Primary Login Email</span>
                      <p className="text-sm font-semibold text-white">{user?.email || profile.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsChangeEmailModalOpen(true)}
                      >
                        Change Email
                      </Button>
                      <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active Session
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-zinc-400">
                      <span>Password Reset:</span> Send a secure password change link to your login email.
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleRequestPasswordReset}
                      isLoading={isResetPasswordSending}
                      leftIcon={<KeyRound className="w-3.5 h-3.5 text-amber-400" />}
                    >
                      Send Password Reset Link
                    </Button>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-zinc-400">
                      <span>Session Control:</span> Sign out of your FlowDesk workspace on this device.
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSignOut}
                      isLoading={isSigningOut}
                      leftIcon={<LogOut className="w-3.5 h-3.5 text-zinc-400" />}
                      className="border-white/10 hover:border-white/30 text-zinc-300 hover:text-white"
                    >
                      Sign Out
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card variant="crystal" className="border-rose-500/20 bg-rose-950/10">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  <CardTitle className="text-rose-400">Danger Zone</CardTitle>
                </div>
                <CardDescription className="text-rose-300/70">
                  Irreversible actions for studio preferences, workspace data, and account lifecycle
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-rose-500/20 bg-rose-950/20">
                  <div>
                    <h4 className="text-xs font-bold text-rose-200">Reset Studio Preferences to Defaults</h4>
                    <p className="text-[11px] text-rose-300/60 mt-0.5">
                      Clears local cache and resets user settings table to original system defaults.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDangerModalOpen(true)}
                    className="border-rose-500/40 text-rose-300 hover:bg-rose-500/20 shrink-0"
                  >
                    Reset Preferences...
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-rose-500/20 bg-rose-950/20">
                  <div>
                    <h4 className="text-xs font-bold text-rose-200">Delete Freelancer Account (5-Day Grace Period)</h4>
                    <p className="text-[11px] text-rose-300/60 mt-0.5">
                      Suspends workspace access and client portals immediately. You can log back in within 5 days to restore your account before permanent deletion.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDeleteAccountModalOpen(true)}
                    className="border-rose-500/40 text-rose-300 hover:bg-rose-500/20 shrink-0"
                  >
                    Delete Account...
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Save Action Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          {dirty ? (
            <p className="text-xs text-amber-400 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              You have unsaved changes
            </p>
          ) : (
            <p className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> All preferences saved
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={saving}
            disabled={!dirty}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Preferences
          </Button>
        </div>
      </form>

      {/* Change Email Modal */}
      {isChangeEmailModalOpen && (
        <Modal
          isOpen={isChangeEmailModalOpen}
          onClose={() => {
            setIsChangeEmailModalOpen(false);
            setNewLoginEmail('');
          }}
          title="Change Primary Login Email"
        >
          <form onSubmit={handleChangeLoginEmail} className="space-y-4">
            <p className="text-xs text-zinc-300">
              Enter your new email address. A confirmation link will be sent to verify ownership before the change takes effect.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">New Login Email</label>
              <input
                type="email"
                required
                value={newLoginEmail}
                onChange={(e) => setNewLoginEmail(e.target.value)}
                placeholder="new-email@example.com"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsChangeEmailModalOpen(false);
                  setNewLoginEmail('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isChangingEmail}
              >
                Send Verification Link
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Danger Zone Confirmation Modal */}
      {isDangerModalOpen && (
        <Modal
          isOpen={isDangerModalOpen}
          onClose={() => {
            setIsDangerModalOpen(false);
            setDangerConfirmText('');
          }}
          title="Confirm Workspace Settings Reset"
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-300 leading-relaxed">
              This action will reset your user settings table and clear cached studio preferences. To confirm, please type{' '}
              <strong className="text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">RESET</strong> below:
            </p>
            <input
              type="text"
              value={dangerConfirmText}
              onChange={(e) => setDangerConfirmText(e.target.value)}
              placeholder="Type RESET to confirm"
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-rose-500/30 text-sm font-mono text-white focus:outline-none focus:border-rose-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDangerModalOpen(false);
                  setDangerConfirmText('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleResetWorkspace}
                disabled={dangerConfirmText.trim().toUpperCase() !== 'RESET'}
                className="bg-rose-600 hover:bg-rose-500 text-white"
              >
                Confirm Reset
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Freelancer Account Deletion Modal */}
      {isDeleteAccountModalOpen && (
        <Modal
          isOpen={isDeleteAccountModalOpen}
          onClose={() => {
            setIsDeleteAccountModalOpen(false);
            setDeleteConfirmText('');
          }}
          title="Delete Workspace & Freelancer Account"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed space-y-2">
              <p className="font-semibold flex items-center gap-1.5 text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                5-Day Account Recovery Period
              </p>
              <p>
                Deleting your account will immediately suspend access to your workspace, documents, and client portals.
              </p>
              <p>
                You can recover and restore your account at any time by simply logging back into FlowDesk within <strong>5 days</strong>. After 5 days, all data, clients, invoices, and storage files will be permanently purged.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                To confirm deletion, type <span className="font-mono font-bold text-rose-400">DELETE</span> below:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-rose-500/30 text-sm font-mono text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDeleteAccountModalOpen(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleDeleteFreelancerAccount}
                isLoading={isDeletingAccount}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                className="bg-rose-600 hover:bg-rose-500 text-white"
              >
                Confirm Account Deletion
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};


