import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { UpgradeModal } from '@/frontend/shared/billing/upgrade-modal';
import { WorkspaceEntitlements } from '@/backend/billing/entitlements';
import { useToast } from '@/frontend/shared/ui/toast';
import {
  Sparkles,
  CreditCard,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardDrive,
  Users,
  FolderKanban,
  Receipt,
  ArrowUpRight,
} from 'lucide-react';

export const BillingPlanPanel: React.FC = () => {
  const [entitlements, setEntitlements] = useState<WorkspaceEntitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { showToast } = useToast();

  const fetchBillingStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/billing/status', {
        headers: { 'Cache-Control': 'no-store' },
      });
      if (!res.ok) {
        throw new Error('Could not load billing status.');
      }
      const data = await res.json();
      setEntitlements(data.entitlements);
    } catch (err: any) {
      setError(err?.message || 'Failed to load subscription details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    fetch('/api/billing/status', {
      headers: { 'Cache-Control': 'no-store' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Could not load billing status.');
        return res.json();
      })
      .then((data) => {
        if (mounted) {
          setEntitlements(data.entitlements);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (mounted) {
          setError(err?.message || 'Failed to load subscription details.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription at the end of the billing cycle?')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atPeriodEnd: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to cancel.');
      showToast('Subscription Cancelled', 'Your subscription will not renew after this cycle.', 'info');
      await fetchBillingStatus();
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to cancel subscription.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/billing/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to resume.');
      showToast('Subscription Resumed', 'Automatic renewal has been restored.', 'success');
      await fetchBillingStatus();
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to resume subscription.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <Card variant="crystal" className="p-8">
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <p className="text-xs text-zinc-400 font-mono">Loading subscription & entitlements...</p>
        </div>
      </Card>
    );
  }

  if (error || !entitlements) {
    return (
      <Card variant="crystal" className="p-6">
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{error || 'Subscription data unavailable'}</p>
            <p className="text-zinc-400 mt-0.5">Please check your network connection and retry.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchBillingStatus}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  const { planKey, planName, status, currentPeriodEnd, cancelAtPeriodEnd, limits, usage } = entitlements;

  const renderStatusBanner = () => {
    if (status === 'grace') {
      return (
        <div className="flex items-center justify-between p-4 bg-red-500/15 border border-red-500/30 rounded-2xl text-xs text-red-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="font-bold text-red-100">Workspace in Grace Period</p>
              <p className="text-red-300/90 text-[11px] mt-0.5">
                Payment attempts failed. Please update your payment method to restore full write access.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white shadow-none"
            onClick={() => setIsUpgradeModalOpen(true)}
          >
            Update Payment
          </Button>
        </div>
      );
    }

    if (status === 'past_due') {
      return (
        <div className="flex items-center justify-between p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-xs text-amber-200">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold text-amber-100">Payment Retrying</p>
              <p className="text-amber-300/90 text-[11px] mt-0.5">
                The latest subscription charge failed. Razorpay will automatically re-attempt debit shortly.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setIsUpgradeModalOpen(true)}>
            Update Card
          </Button>
        </div>
      );
    }

    if (cancelAtPeriodEnd) {
      return (
        <div className="flex items-center justify-between p-4 bg-zinc-800/80 border border-white/10 rounded-2xl text-xs text-zinc-300">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-zinc-400 shrink-0" />
            <div>
              <p className="font-semibold text-white">Cancellation Scheduled</p>
              <p className="text-zinc-400 text-[11px] mt-0.5">
                Your plan will remain active until{' '}
                {currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : 'the end of this billing cycle'}.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResumeSubscription}
            disabled={actionLoading}
          >
            {actionLoading ? 'Resuming...' : 'Resume Subscription'}
          </Button>
        </div>
      );
    }

    if (status === 'trialing') {
      return (
        <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-bold text-emerald-200">Free Pro Trial Active</p>
              <p className="text-emerald-400/80 text-[11px] mt-0.5">
                Enjoy full access to Pro freelancer features during your trial period.
              </p>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => setIsUpgradeModalOpen(true)}>
            Subscribe to Pro
          </Button>
        </div>
      );
    }

    return null;
  };

  const renderUsageBar = (
    label: string,
    current: number,
    limit: number,
    icon: React.ReactNode,
    unit: string = ''
  ) => {
    const pct = Math.min(Math.round((current / limit) * 100), 100);
    const isNearLimit = pct >= 80;
    const isAtLimit = pct >= 100;

    return (
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-300 font-medium">
            {icon}
            <span>{label}</span>
          </div>
          <span className="font-mono text-zinc-400 text-[11px]">
            <strong className="text-white">{current}</strong> / {limit} {unit}
          </span>
        </div>

        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderStatusBanner()}

      {/* Plan Header Card */}
      <Card variant="crystal">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{planName}</span>
              </div>
              <CardTitle className="text-xl">Platform Subscription</CardTitle>
              <CardDescription>Manage your FlowDesk workspace tier, usage limits, and invoices</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={() => setIsUpgradeModalOpen(true)}
                rightIcon={<ArrowUpRight className="w-4 h-4" />}
              >
                {planKey === 'free' ? 'Upgrade Plan' : 'Change Plan'}
              </Button>

              {planKey !== 'free' && !cancelAtPeriodEnd && (
                <Button
                  variant="secondary"
                  onClick={handleCancelSubscription}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Quota Progress Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Workspace Quotas & Usage</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {renderUsageBar('Active Clients', usage.activeClients, limits.activeClients, <Users className="w-4 h-4 text-emerald-400" />)}
              {renderUsageBar('Active Projects', usage.activeProjects, limits.activeProjects, <FolderKanban className="w-4 h-4 text-blue-400" />)}
              {renderUsageBar('Monthly Invoices', usage.invoicesPerMonth, limits.invoicesPerMonth, <Receipt className="w-4 h-4 text-amber-400" />)}
              {renderUsageBar('Storage Allocation', usage.storageMb, limits.storageMb, <HardDrive className="w-4 h-4 text-purple-400" />, 'MB')}
            </div>
          </div>

          {/* Entitlement Badges */}
          <div className="pt-4 border-t border-white/10 flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-zinc-300">
              <CheckCircle2 className={`w-3.5 h-3.5 ${limits.brandedPortal ? 'text-emerald-400' : 'text-zinc-400'}`} />
              <span>Branded Client Portal: {limits.brandedPortal ? 'Enabled' : 'Free Default'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-zinc-300">
              <CheckCircle2 className={`w-3.5 h-3.5 ${limits.emailReminders ? 'text-emerald-400' : 'text-zinc-400'}`} />
              <span>Automated Email Reminders: {limits.emailReminders ? 'Enabled' : 'Manual Only'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        currentPlanKey={planKey}
        onSuccess={fetchBillingStatus}
      />
    </div>
  );
};
