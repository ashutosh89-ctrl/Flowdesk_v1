import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Modal } from '@/frontend/shared/ui/modal';
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
  Shield,
  FileText,
} from 'lucide-react';

export const BillingPlanPanel: React.FC = () => {
  const [entitlements, setEntitlements] = useState<WorkspaceEntitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
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
      setIsCancelModalOpen(false);
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
          <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
          <p className="text-xs text-zinc-400 font-mono">Loading subscription &amp; entitlements...</p>
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

  const { planKey, planName, status, currentPeriodEnd, cancelAtPeriodEnd } = entitlements;
  const limits = {
    activeClients: entitlements.limits?.activeClients ?? 0,
    activeProjects: entitlements.limits?.activeProjects ?? 0,
    invoicesPerMonth: entitlements.limits?.invoicesPerMonth ?? 0,
    storageMb: entitlements.limits?.storageMb ?? 0,
    brandedPortal: entitlements.limits?.brandedPortal ?? false,
    emailReminders: entitlements.limits?.emailReminders ?? false,
  };
  const usage = {
    activeClients: entitlements.usage?.activeClients ?? 0,
    activeProjects: entitlements.usage?.activeProjects ?? 0,
    invoicesPerMonth: entitlements.usage?.invoicesPerMonth ?? 0,
    storageMb: entitlements.usage?.storageMb ?? 0,
  };

  const formattedPeriodEnd = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const renderStatusBanner = () => {
    if (status === 'grace') {
      return (
        <div className="flex items-center justify-between p-4 bg-red-500/15 border border-red-500/30 rounded-2xl text-xs text-red-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="font-bold text-red-100">Workspace in Grace Period</p>
              <p className="text-red-300/90 text-[11px] mt-0.5">
                Payment retry exhausted. Please update your payment instrument to restore write access. Existing data remains fully accessible.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white shadow-none shrink-0"
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
                The latest subscription charge was declined. Razorpay will automatically re-attempt debit shortly.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setIsUpgradeModalOpen(true)} className="shrink-0">
            Update Payment Method
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
                Your plan will remain active with full features until {formattedPeriodEnd || 'the end of this billing cycle'}, after which it will revert to the Starter tier.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResumeSubscription}
            disabled={actionLoading}
            className="shrink-0"
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
              <p className="font-bold text-emerald-200">Pro Trial Active</p>
              <p className="text-emerald-400/80 text-[11px] mt-0.5">
                Enjoy full access to advanced freelancer features during your trial period.
              </p>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => setIsUpgradeModalOpen(true)} className="shrink-0">
            Activate Subscription
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
    const isUnlimited = limit >= 1000;
    const pct = isUnlimited ? 5 : limit > 0 ? Math.min(Math.round((current / limit) * 100), 100) : 0;
    const isNearLimit = !isUnlimited && pct >= 80;
    const isAtLimit = !isUnlimited && pct >= 100;

    return (
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-300 font-medium">
            {icon}
            <span>{label}</span>
          </div>
          <span className="font-mono text-zinc-400 text-[11px]">
            <strong className="text-white">{current}</strong> / {isUnlimited ? 'Unlimited (fair use)' : `${limit} ${unit}`.trim()}
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
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0047AB]/20 text-[#E8F0FF] border border-[#2563EB]/30 text-xs font-mono mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>{planName}</span>
                {status === 'active' && <span className="text-[10px] text-emerald-400 font-bold">&bull; Active</span>}
              </div>
              <CardTitle className="text-xl">Platform Subscription</CardTitle>
              <CardDescription>
                Manage your FlowDesk workspace tier, usage limits, and invoices.
                {formattedPeriodEnd && !cancelAtPeriodEnd && (
                  <span className="block mt-0.5 text-zinc-400 text-xs">Next renewal date: {formattedPeriodEnd}</span>
                )}
              </CardDescription>
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
                  onClick={() => setIsCancelModalOpen(true)}
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
            <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Workspace Quotas &amp; Usage</h4>
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
              <CheckCircle2 className={`w-3.5 h-3.5 ${limits.brandedPortal ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <span>Branded Client Portal: {limits.brandedPortal ? 'Enabled' : 'Free Default'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-zinc-300">
              <CheckCircle2 className={`w-3.5 h-3.5 ${limits.emailReminders ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <span>Automated Email Reminders: {limits.emailReminders ? 'Enabled' : 'Manual Only'}</span>
            </div>
          </div>

          {/* Policy Links & Billing Transparency Footer */}
          <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 font-mono gap-3">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-zinc-400" />
              <span>Payments handled securely via Razorpay e-mandate.</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/terms" target="_blank" className="hover:text-white underline">Terms</Link>
              <span>&bull;</span>
              <Link href="/refund-policy" target="_blank" className="hover:text-white underline">Refund Policy</Link>
              <span>&bull;</span>
              <Link href="/cancellation-policy" target="_blank" className="hover:text-white underline">Cancellation Policy</Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade / Change Plan Modal */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        currentPlanKey={planKey}
        onSuccess={fetchBillingStatus}
      />

      {/* Dedicated Cancellation Confirmation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Platform Subscription"
        description="Review how cancellation takes effect and how your data is protected."
        size="md"
      >
        <div className="space-y-4 pt-2 text-sm text-zinc-300">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 text-xs">
            <p className="font-semibold text-white">What happens next:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
              <li>
                <strong>Active until cycle end:</strong> Your workspace retains all {planName} features and quotas until{' '}
                <strong className="text-white">{formattedPeriodEnd || 'the end of your current cycle'}</strong>.
              </li>
              <li>
                <strong>Zero data deletion:</strong> All of your existing clients, projects, deliverables, documents, and historical invoices remain completely intact and exportable.
              </li>
              <li>
                <strong>Automatic fallback to Starter:</strong> At the end of the paid cycle, your workspace reverts to the Free Starter tier (₹0/forever).
              </li>
              <li>
                <strong>No future debits:</strong> Your recurring Razorpay payment mandate will be cancelled.
              </li>
            </ul>
          </div>

          <p className="text-xs text-zinc-400">
            For full details on grandfathered quotas and renewal cancellation, read our{' '}
            <Link href="/cancellation-policy" target="_blank" className="text-white underline">
              Cancellation Policy
            </Link>
            .
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <Button variant="secondary" size="sm" onClick={() => setIsCancelModalOpen(false)}>
              Keep Subscription
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-red-500 hover:bg-red-600 text-white shadow-none"
              onClick={handleCancelSubscription}
              isLoading={actionLoading}
            >
              {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
