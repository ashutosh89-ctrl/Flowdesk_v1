'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/frontend/auth/auth-context';
import { ToastProvider, useToast } from '@/frontend/shared/ui/toast';
import { Button } from '@/frontend/shared/ui/button';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { AccountDeletionService } from '@/backend/auth/account-deletion-service';
import { AlertTriangle, RotateCcw, LogOut, ShieldAlert, Loader2 } from 'lucide-react';

function RecoverAccountContent() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<{
    isPendingDeletion: boolean;
    daysRemaining?: number;
    restoreUntil?: string;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const status = await AccountDeletionService.getFreelancerDeletionStatus(user.id);
        if (mounted) {
          setDeletionStatus(status);
          if (!status.isPendingDeletion) {
            router.replace('/dashboard');
          }
        }
      } catch (err) {
        console.warn('Notice checking deletion status:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchStatus();
    return () => {
      mounted = false;
    };
  }, [user?.id, router]);

  const handleRestore = async () => {
    if (!user?.id) return;
    setRestoring(true);
    try {
      const res = await AccountDeletionService.restoreFreelancerAccount(user.id);
      if (res.success) {
        showToast('Account Restored', 'Your workspace and client access have been fully restored.', 'success');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 800);
      } else {
        showToast('Error', res.error || 'Failed to restore account.', 'error');
      }
    } catch (err: any) {
      showToast('Error', err.message || 'An unexpected error occurred.', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070708] text-white flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto" />
          <p className="text-xs text-zinc-400 font-mono">Checking account status...</p>
        </div>
      </div>
    );
  }

  const daysRemaining = deletionStatus?.daysRemaining ?? 5;

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-white selection:text-zinc-950 relative overflow-hidden">
      {/* Ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 bg-rose-500/[0.05] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-rose-500/[0.05] rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md p-7 sm:p-9 rounded-3xl bg-zinc-900/90 border border-rose-500/20 shadow-[0_30px_90px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(255,255,255,0.15)] backdrop-blur-2xl space-y-6 relative z-10">
        <div className="flex items-center justify-between">
          <FlowDeskLogo variant="full" size="sm" priority />

          <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-mono font-bold flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            Pending Deletion
          </span>
        </div>

        <div className="space-y-2 text-center pt-2">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Workspace Scheduled for Deletion</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Your FlowDesk account was placed into pending deletion. You are currently in the <strong>5-day recovery period</strong>.
          </p>
        </div>

        {/* Grace Period Counter Card */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 space-y-2 text-center">
          <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block">Recovery Deadline</span>
          <div className="text-3xl font-extrabold text-white font-mono">
            {daysRemaining} {daysRemaining === 1 ? 'Day' : 'Days'} Remaining
          </div>
          {deletionStatus?.restoreUntil && (
            <p className="text-[11px] text-zinc-400 font-mono">
              Restorable until {new Date(deletionStatus.restoreUntil).toLocaleDateString()}
            </p>
          )}
          <p className="text-[11px] text-zinc-500 leading-relaxed pt-1">
            After this window expires, all documents, client records, invoices, and storage files will be permanently erased.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button
            variant="primary"
            size="lg"
            className="w-full justify-center bg-white text-zinc-950 hover:bg-zinc-200 font-bold"
            onClick={handleRestore}
            isLoading={restoring}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Restore My Account & Workspace
          </Button>

          <Button
            variant="outline"
            size="md"
            className="w-full justify-center border-white/10 hover:border-white/25 text-zinc-300 hover:text-white"
            onClick={handleSignOut}
            isLoading={signingOut}
            leftIcon={<LogOut className="w-4 h-4 text-zinc-400" />}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RecoverPage() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RecoverAccountContent />
      </AuthProvider>
    </ToastProvider>
  );
}
