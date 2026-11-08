'use client';

import React, { useState } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { Button } from '@/frontend/shared/ui/button';
import { UpgradeModal } from '@/frontend/shared/billing/upgrade-modal';
import { Clock, ShieldAlert, Sparkles, Check, ArrowRight } from 'lucide-react';
import { WorkspaceEntitlements } from '@/backend/billing/entitlements';

export interface TrialExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  entitlements?: WorkspaceEntitlements | null;
  onSuccess?: () => void;
}

export const TrialExpiredModal: React.FC<TrialExpiredModalProps> = ({
  isOpen,
  onClose,
  entitlements,
  onSuccess,
}) => {
  const [upgradeTarget, setUpgradeTarget] = useState<'standard' | 'studio' | null>(null);

  const usage = entitlements?.usage || {
    activeClients: 0,
    activeProjects: 0,
    invoicesPerMonth: 0,
  };

  return (
    <>
      <Modal isOpen={isOpen && !upgradeTarget} onClose={onClose} title="Promotional Period Concluded" size="lg">
        <div className="space-y-6 pt-1 pb-2">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10 mx-auto">
              <Clock className="w-7 h-7 text-amber-400" />
            </div>

            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Your free Standard period has ended
            </h2>

            <p className="text-sm text-zinc-300 leading-relaxed max-w-lg mx-auto">
              Your 30-day FlowDesk launch benefit has expired. Your workspace is now on Starter. Upgrade to continue using Standard features, custom branding, automated reminders and higher workspace limits.
            </p>
          </div>

          {/* Current Workspace Status */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Current Plan: Starter (Free)</span>
              <span className="text-zinc-400 font-mono">Starter Quota Limits Applied</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[10px] text-zinc-400 font-mono block">Clients</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{usage.activeClients} / 2</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[10px] text-zinc-400 font-mono block">Projects</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{usage.activeProjects} / 3</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[10px] text-zinc-400 font-mono block">Monthly Invoices</span>
                <span className="text-sm font-bold text-white mt-0.5 block">{usage.invoicesPerMonth} / 5</span>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 leading-normal">
              All your previously created projects, deliverables, and invoices remain safely preserved in your workspace.
            </p>
          </div>

          {/* Plans Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Standard Plan Option */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3 relative flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">Standard</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">Recommended</span>
                </div>
                <div className="flex items-baseline gap-1 text-white">
                  <span className="text-2xl font-extrabold">₹399</span>
                  <span className="text-xs text-zinc-400">/month (or ₹3,990/year)</span>
                </div>
                <ul className="text-xs text-zinc-300 space-y-1.5 pt-1">
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Up to 15 clients & 25 projects</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Custom branding & logo active</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Automated payment reminders</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 50 invoices / month</li>
                </ul>
              </div>

              <Button
                type="button"
                variant="primary"
                onClick={() => setUpgradeTarget('standard')}
                className="w-full bg-[#43D6B0] hover:bg-[#43D6B0]/90 text-zinc-950 font-bold text-xs"
              >
                Upgrade to Standard
              </Button>
            </div>

            {/* Studio Plan Option */}
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">Studio</span>
                <div className="flex items-baseline gap-1 text-white">
                  <span className="text-2xl font-extrabold">₹899</span>
                  <span className="text-xs text-zinc-400">/month (or ₹8,990/year)</span>
                </div>
                <ul className="text-xs text-zinc-300 space-y-1.5 pt-1">
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Unlimited clients & projects</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Custom portal subpaths</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Audit log exports</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Unlimited invoices</li>
                </ul>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => setUpgradeTarget('studio')}
                className="w-full text-xs font-bold"
              >
                Explore Studio
              </Button>
            </div>
          </div>

          {/* Tertiary Action: Continue with Starter */}
          <div className="flex items-center justify-center pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors underline underline-offset-4"
            >
              Continue with Starter
            </button>
          </div>
        </div>
      </Modal>

      {/* Razorpay Upgrade Modal for Chosen Plan */}
      {upgradeTarget && (
        <UpgradeModal
          isOpen={Boolean(upgradeTarget)}
          onClose={() => setUpgradeTarget(null)}
          currentPlanKey="starter"
          targetPlanKey={upgradeTarget}
          onSuccess={() => {
            setUpgradeTarget(null);
            onSuccess?.();
            onClose();
          }}
        />
      )}
    </>
  );
};
