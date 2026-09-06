'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Modal } from '@/frontend/shared/ui/modal';
import { useToast } from '@/frontend/shared/ui/toast';
import { PortalProfile } from '@/shared/types';
import { ClientAuthService } from '@/backend/client/client-auth-service';
import {
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  ShieldCheck,
  Clock,
  Languages,
  LogOut,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

interface ProfilePanelProps {
  profile: PortalProfile;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ profile }) => {
  const { showToast } = useToast();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await ClientAuthService.logout();
      showToast('Signed Out', 'You have been signed out of the client portal.', 'info');
      setTimeout(() => {
        window.location.href = '/client/login';
      }, 300);
    } catch {
      window.location.href = '/client/login';
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      showToast('Confirmation Required', 'Please type DELETE to confirm account deletion.', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      const res = await ClientAuthService.deleteOwnAccount(profile.clientId || profile.id);
      if (res.success) {
        setIsDeleteModalOpen(false);
        setDeleteConfirmText('');
        showToast(
          'Account Deletion Requested',
          'Your client account has been placed in pending deletion. Your service provider can restore it within 30 days.',
          'info'
        );
        setTimeout(() => {
          window.location.href = '/client/login?deleted=1';
        }, 1200);
      } else {
        showToast('Error', res.error || 'Failed to process account deletion.', 'error');
      }
    } catch (err: any) {
      showToast('Error', err.message || 'An unexpected error occurred.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans max-w-3xl">
      <div className="pb-2 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Client Account & Profile</h2>
          <p className="text-xs text-zinc-400">View contact records and workspace preferences</p>
        </div>
        <Button
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

      <Card variant="crystal" className="p-6 border-white/15 space-y-6">
        {/* Header Profile Summary */}
        <div className="flex items-center gap-4 pb-6 border-b border-white/10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white to-zinc-300 text-zinc-950 font-extrabold text-xl flex items-center justify-center shadow-lg">
            {profile.company ? profile.company.charAt(0) : 'C'}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{profile.company}</h3>
            <p className="text-xs text-zinc-400">Primary Contact: {profile.contactPerson}</p>
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
              <ShieldCheck className="w-3 h-3" />
              Verified Enterprise Account
            </span>
          </div>
        </div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-400" />
              Company Organization
            </span>
            <p className="text-sm font-bold text-white">{profile.company}</p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-zinc-400" />
              Contact Person
            </span>
            <p className="text-sm font-bold text-white">{profile.contactPerson}</p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-zinc-400" />
              Primary Email
            </span>
            <p className="text-xs font-mono font-bold text-white">{profile.email}</p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-zinc-400" />
              Direct Phone Number
            </span>
            <p className="text-xs font-mono font-bold text-white">{profile.phone || 'Not provided'}</p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-zinc-400" />
              Workspace Timezone
            </span>
            <p className="text-xs font-mono font-bold text-white">{profile.timezone}</p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-zinc-400" />
              Portal Language
            </span>
            <p className="text-xs font-mono font-bold text-white">{profile.portalLanguage || 'English (US)'}</p>
          </div>
        </div>

        {/* Security & Access Audit */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Recent Portal Access</span>
          </div>
          <span className="text-white font-bold">{profile.recentAccess || 'Just now'}</span>
        </div>
      </Card>

      {/* Danger Zone: Client Account Deletion */}
      <Card variant="crystal" className="border-rose-500/20 bg-rose-950/10 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-500" />
          <h3 className="text-sm font-bold text-rose-300">Danger Zone — Account Deletion</h3>
        </div>
        <p className="text-xs text-rose-300/70 leading-relaxed">
          Requesting account deletion will immediately lock and suspend this client portal. Your service provider / freelancer has a 30-day recovery window to restore your workspace if requested. After 30 days, your client record and associated documents are permanently erased.
        </p>
        <div className="pt-2 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteModalOpen(true)}
            className="border-rose-500/40 text-rose-300 hover:bg-rose-500/20"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete Account...
          </Button>
        </div>
      </Card>

      {/* Delete Client Account Modal */}
      {isDeleteModalOpen && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDeleteConfirmText('');
          }}
          title="Confirm Client Account Deletion"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed space-y-2">
              <p className="font-semibold text-rose-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                30-Day Recovery Period
              </p>
              <p>
                Deleting your account will immediately revoke portal access. Your freelancer or service provider retains the ability to restore your client account within <strong>30 days</strong>.
              </p>
              <p>
                After 30 days, all client records, revision comments, and files will be permanently purged from the system.
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
                  setIsDeleteModalOpen(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleDeleteAccount}
                isLoading={isDeleting}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                className="bg-rose-600 hover:bg-rose-500 text-white"
              >
                Confirm Deletion
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

