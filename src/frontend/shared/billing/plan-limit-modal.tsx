'use client';

import React, { useEffect, useState } from 'react';
import { PlanKey, BILLING_PLANS } from '@/shared/billing';
import { Button } from '@/frontend/shared/ui/button';
import { UpgradeModal } from './upgrade-modal';
import {
  Users,
  FolderKanban,
  Receipt,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  X,
  Mail,
  Archive,
} from 'lucide-react';

export interface PlanLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  metric?: 'activeClients' | 'activeProjects' | 'invoicesPerMonth' | string;
  currentPlan?: PlanKey;
  currentUsage?: number;
  maxAllowed?: number;
  recommendedPlan?: PlanKey | null;
  title?: string;
  description?: string;
  onUpgrade?: () => void;
}

export const PlanLimitModal: React.FC<PlanLimitModalProps> = ({
  isOpen,
  onClose,
  metric = 'activeClients',
  currentPlan = 'starter',
  currentUsage,
  maxAllowed,
  recommendedPlan,
  title,
  description,
  onUpgrade,
}) => {
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Keyboard accessibility: ESC key dismiss
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Derive normalized plan and target
  const normalizedCurrentPlan: PlanKey =
    currentPlan === 'free' ? 'starter' : currentPlan === 'pro' ? 'standard' : currentPlan;

  const resolvedTargetPlan: PlanKey | null =
    recommendedPlan !== undefined
      ? recommendedPlan
      : normalizedCurrentPlan === 'starter'
      ? 'standard'
      : normalizedCurrentPlan === 'standard'
      ? 'studio'
      : null;

  const isStudioMax = normalizedCurrentPlan === 'studio' || resolvedTargetPlan === null;

  // Resolve Metric Details
  let metricLabel = 'Records';
  let MetricIcon = Sparkles;
  let defaultUsage = 2;
  let defaultMax = 2;
  let heading = title || "You've reached your limit";
  let explanation = description || 'Upgrade your subscription to unlock higher operational capacity.';
  let usageLabel = '';

  if (metric === 'activeClients') {
    MetricIcon = Users;
    metricLabel = 'Active Clients';
    if (normalizedCurrentPlan === 'starter') {
      defaultUsage = 2;
      defaultMax = 2;
      heading = title || "You've reached your client limit";
      explanation =
        description ||
        'Your Starter plan supports up to 2 active clients. Upgrade to Standard to manage up to 15 active clients.';
    } else if (normalizedCurrentPlan === 'standard') {
      defaultUsage = 15;
      defaultMax = 15;
      heading = title || 'Your workspace is growing!';
      explanation =
        description ||
        "You've reached the 15 active client limit on Standard. Upgrade to Studio to manage up to 100 active clients.";
    } else {
      defaultUsage = 100;
      defaultMax = 100;
      heading = title || 'Maximum Client Capacity Reached';
      explanation =
        description ||
        'Your Studio Agency workspace has reached the maximum capacity of 100 active clients. Archive completed client workspaces or contact our dedicated support for high-throughput scaling.';
    }
  } else if (metric === 'activeProjects') {
    MetricIcon = FolderKanban;
    metricLabel = 'Active Projects';
    if (normalizedCurrentPlan === 'starter') {
      defaultUsage = 3;
      defaultMax = 3;
      heading = title || "You've reached your project limit";
      explanation =
        description ||
        'Your Starter plan supports up to 3 active projects. Upgrade to Standard to manage up to 25 active projects.';
    } else if (normalizedCurrentPlan === 'standard') {
      defaultUsage = 25;
      defaultMax = 25;
      heading = title || 'Your workspace is growing!';
      explanation =
        description ||
        "You've reached the 25 active project limit on Standard. Upgrade to Studio to manage up to 150 active projects.";
    } else {
      defaultUsage = 150;
      defaultMax = 150;
      heading = title || 'Maximum Project Capacity Reached';
      explanation =
        description ||
        'Your Studio Agency workspace has reached the maximum capacity of 150 active projects. Archive completed projects to begin new client engagements.';
    }
  } else if (metric === 'invoicesPerMonth') {
    MetricIcon = Receipt;
    metricLabel = 'Invoices This Month';
    if (normalizedCurrentPlan === 'starter') {
      defaultUsage = 5;
      defaultMax = 5;
      heading = title || 'Monthly invoice limit reached';
      explanation =
        description ||
        "You've used all 5 invoices available on Starter this month. Upgrade to Standard for up to 50 invoices per month with custom auto-numbering.";
    } else if (normalizedCurrentPlan === 'standard') {
      defaultUsage = 50;
      defaultMax = 50;
      heading = title || 'Monthly invoice limit reached';
      explanation =
        description ||
        "You've used all 50 invoices available on Standard this month. Upgrade to Studio for up to 500 invoices per month.";
    } else {
      defaultUsage = 500;
      defaultMax = 500;
      heading = title || 'Monthly Invoice Cap Reached';
      explanation =
        description ||
        'Your Studio workspace has reached the 500 monthly invoice limit for the current billing cycle. Invoice quotas will refresh at the start of your next billing cycle.';
    }
  }

  const effectiveCurrentUsage = currentUsage !== undefined ? currentUsage : defaultUsage;
  const effectiveMaxAllowed = maxAllowed !== undefined ? maxAllowed : defaultMax;
  usageLabel = `${effectiveCurrentUsage} / ${effectiveMaxAllowed} ${metricLabel.toLowerCase()}`;

  const targetPlanName = resolvedTargetPlan
    ? BILLING_PLANS[resolvedTargetPlan]?.name || resolvedTargetPlan.toUpperCase()
    : null;

  const handlePrimaryClick = () => {
    if (isStudioMax) {
      window.location.href = 'mailto:flowdesk11@gmail.com?subject=Studio%20High%20Capacity%20Inquiry';
      return;
    }

    if (onUpgrade) {
      onUpgrade();
    } else {
      setIsUpgradeModalOpen(true);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-limit-title"
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      >
        <div className="relative w-full max-w-lg bg-[#111111]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl text-white">
          {/* Subtle Accent Glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none" />

          {/* Close Icon */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Header with Icon */}
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl border ${
                  isStudioMax
                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}
              >
                {isStudioMax ? <ShieldAlert className="w-6 h-6" /> : <MetricIcon className="w-6 h-6" />}
              </div>
              <div className="space-y-1 pr-6">
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  {BILLING_PLANS[normalizedCurrentPlan]?.name || normalizedCurrentPlan.toUpperCase()} TIER
                </span>
                <h2 id="plan-limit-title" className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {heading}
                </h2>
              </div>
            </div>

            {/* Explanation Prose */}
            <p className="text-sm text-zinc-300 leading-relaxed">{explanation}</p>

            {/* Usage Progress Meter Card */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium">{metricLabel}</span>
                <span className="font-mono font-bold text-zinc-200">{usageLabel}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isStudioMax ? 'bg-amber-500' : 'bg-emerald-400'
                  }`}
                  style={{ width: '100%' }}
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                {isStudioMax
                  ? 'Archiving completed records frees up active capacity immediately.'
                  : `100% of your ${BILLING_PLANS[normalizedCurrentPlan]?.name} allocation is currently utilized.`}
              </p>
            </div>

            {/* Recommended Target Tier Benefit (if not at Studio maximum) */}
            {!isStudioMax && resolvedTargetPlan && (
              <div className="p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-white">Unlock with {targetPlanName}</p>
                    <p className="text-zinc-400 text-[11px]">
                      {resolvedTargetPlan === 'standard'
                        ? '15 clients, 25 projects, 50 invoices/mo, and branded portal.'
                        : '100 clients, 150 projects, 500 invoices/mo, and custom subpaths.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="w-full sm:w-auto text-zinc-400 hover:text-white text-xs"
              >
                {isStudioMax ? 'Dismiss' : 'Maybe later'}
              </Button>

              <Button
                type="button"
                variant="primary"
                onClick={handlePrimaryClick}
                className="w-full sm:w-auto text-xs px-5 font-semibold"
                rightIcon={
                  isStudioMax ? (
                    <Mail className="w-3.5 h-3.5 text-black" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 text-black" />
                  )
                }
              >
                {isStudioMax ? 'Contact Dedicated Support' : `Upgrade to ${targetPlanName}`}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Upgrade Checkout Modal */}
      {isUpgradeModalOpen && (
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => {
            setIsUpgradeModalOpen(false);
            onClose();
          }}
          currentPlanKey={normalizedCurrentPlan}
          targetPlanKey={resolvedTargetPlan || 'standard'}
          featureNotice={explanation}
          onSuccess={() => {
            setIsUpgradeModalOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
};
