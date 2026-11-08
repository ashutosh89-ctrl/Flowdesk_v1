'use client';

import React, { useState } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { Button } from '@/frontend/shared/ui/button';
import { Sparkles, Calendar, Clock, ShieldCheck, Check, ArrowRight } from 'lucide-react';

export interface TrialWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  trialStart?: string | null;
  trialEnd?: string | null;
  daysRemaining?: number;
}

export const TrialWelcomeModal: React.FC<TrialWelcomeModalProps> = ({
  isOpen,
  onClose,
  trialStart,
  trialEnd,
  daysRemaining = 30,
}) => {
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await fetch('/api/billing/trial/dismiss-announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // non-critical
    } finally {
      setDismissing(false);
      onClose();
    }
  };

  const formattedStart = trialStart
    ? new Date(trialStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Today';

  const formattedEnd = trialEnd
    ? new Date(trialEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'in 30 days';

  return (
    <Modal isOpen={isOpen} onClose={handleDismiss} title="Launch Celebration Gift" size="lg">
      <div className="space-y-6 pt-1 pb-2">
        {/* Header Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#43D6B0]/15 border border-[#43D6B0]/30 text-[#43D6B0] shadow-lg shadow-[#43D6B0]/10 mx-auto">
            <Sparkles className="w-7 h-7 text-[#43D6B0]" />
          </div>

          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            🎉 A little launch gift from FlowDesk!
          </h2>

          <p className="text-sm font-semibold text-[#43D6B0]">
            To celebrate the launch of FlowDesk, we&apos;re giving every new customer 30 days of Standard access completely free.
          </p>

          <p className="text-xs text-zinc-300 leading-relaxed max-w-lg mx-auto">
            Explore custom branding, manage more clients and projects, automate invoice reminders, and experience the complete Standard workspace without paying anything during your trial.
          </p>
        </div>

        {/* Plan & Timeline Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-zinc-900/60 rounded-2xl border border-white/10">
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Tier Unlocked</span>
            <span className="text-sm font-bold text-white mt-1">Standard Plan</span>
            <span className="text-[11px] text-emerald-400 font-mono mt-0.5">₹0 (Free Gift)</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Trial Duration</span>
            <span className="text-sm font-bold text-white mt-1">30 Days</span>
            <span className="text-[11px] text-zinc-400 font-mono mt-0.5">{daysRemaining} days remaining</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Access Period</span>
            <span className="text-xs font-semibold text-white mt-1">{formattedStart}</span>
            <span className="text-[10px] text-zinc-400 mt-0.5">until {formattedEnd}</span>
          </div>
        </div>

        {/* Feature List */}
        <div className="space-y-2.5 px-2">
          <p className="text-xs font-semibold text-white">Standard Capabilities Included During Trial:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#43D6B0] shrink-0" />
              <span>Up to 15 active clients</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#43D6B0] shrink-0" />
              <span>Up to 25 active projects</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#43D6B0] shrink-0" />
              <span>Custom logo & invoice branding</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#43D6B0] shrink-0" />
              <span>Automated payment reminders</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#43D6B0] shrink-0" />
              <span>Multi-currency invoicing & receipts</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#43D6B0] shrink-0" />
              <span>Approved deliverable version trail</span>
            </div>
          </div>
        </div>

        {/* Transparent Guarantee Notice */}
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#43D6B0] shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px] text-zinc-300">
            <strong className="text-white">Zero Automatic Charges:</strong> After your free 30-day period ends, your workspace will automatically move to the Starter plan unless you purchase a paid subscription. You will not be charged automatically merely because you received this free promotion.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleDismiss}
            disabled={dismissing}
            className="w-full sm:w-auto text-zinc-400 hover:text-white"
          >
            Let&apos;s get started
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={handleDismiss}
            disabled={dismissing}
            className="w-full sm:w-auto bg-[#43D6B0] hover:bg-[#43D6B0]/90 text-zinc-950 font-bold"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Explore FlowDesk
          </Button>
        </div>
      </div>
    </Modal>
  );
};
