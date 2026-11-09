'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/frontend/shared/ui/modal';
import { Button } from '@/frontend/shared/ui/button';
import { Sparkles, Calendar, Clock, ShieldCheck, Check, ArrowRight, Zap, Info } from 'lucide-react';

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
  const router = useRouter();

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('flowdesk_launch_promotion_dismissed', 'true');
      }
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

  const handleViewPlans = async () => {
    await handleDismiss();
    router.push('/settings?tab=billing');
  };

  const formattedStart = trialStart
    ? new Date(trialStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Today';

  const formattedEnd = trialEnd
    ? new Date(trialEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'in 30 days';

  return (
    <Modal isOpen={isOpen} onClose={handleDismiss} title="New Launch Special Promotion" size="lg">
      <div className="space-y-6 pt-1 pb-2">
        {/* Header Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#43D6B0]/15 border border-[#43D6B0]/30 text-[#43D6B0] text-xs font-mono font-bold uppercase tracking-wider mx-auto">
            <Sparkles className="w-3.5 h-3.5 text-[#43D6B0]" />
            <span>Official Launch Celebration</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            🎉 1 Month Free Standard Pack!
          </h2>

          <p className="text-sm font-semibold text-[#43D6B0] max-w-xl mx-auto leading-snug">
            To celebrate the official launch of FlowDesk, every customer—both newly registered users and all of our existing members—receives 1 month of the Standard Pack completely free!
          </p>

          <p className="text-xs text-zinc-300 leading-relaxed max-w-xl mx-auto">
            You are receiving this special gift directly in your account because of our new launch. Enjoy custom logo &amp; invoice branding, up to 15 clients, 25 projects, automated payment reminders, and multi-currency invoicing without paying anything during your free month.
          </p>
        </div>

        {/* Plan & Timeline Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-zinc-900/60 rounded-2xl border border-white/10">
          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Unlocked Plan</span>
            <span className="text-sm font-bold text-white mt-1">Standard Pack</span>
            <span className="text-[11px] text-[#43D6B0] font-mono font-bold mt-0.5">₹0 (100% Free Gift)</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Promotion Duration</span>
            <span className="text-sm font-bold text-white mt-1">1 Month (30 Days)</span>
            <span className="text-[11px] text-zinc-400 font-mono mt-0.5">{daysRemaining} days remaining</span>
          </div>

          <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Access Period</span>
            <span className="text-xs font-semibold text-white mt-1">{formattedStart}</span>
            <span className="text-[10px] text-zinc-400 mt-0.5">Active until {formattedEnd}</span>
          </div>
        </div>

        {/* What Happens After 1 Month (Explicit Requirement) */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Important: What Happens After 1 Month</span>
          </div>
          <p className="text-xs text-zinc-200 leading-relaxed">
            <strong className="text-white">Purchase Required After 1 Month:</strong> Once your 1-month free launch period ends, you will need to purchase the Standard Pack (₹399/month or ₹3,990/year) to continue using elevated limits, custom branding, and automated reminders.
          </p>
          <p className="text-xs text-zinc-300 leading-relaxed">
            <strong className="text-white">Automatic Downgrade to Starter:</strong> If you choose not to purchase the Standard Pack, your workspace will automatically and smoothly downgrade to the free Starter Pack. <span className="text-amber-200 font-semibold">There are zero automatic deductions or surprise charges.</span> All previously created invoices and documents remain safely preserved.
          </p>
        </div>

        {/* Feature List */}
        <div className="space-y-2.5 px-2">
          <p className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#43D6B0]" />
            <span>Standard Pack Features Active During Your Free Month:</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#43D6B0] shrink-0" />
              <span><strong>Up to 15 Active Clients</strong> (vs 2 on Starter)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#43D6B0] shrink-0" />
              <span><strong>Up to 25 Active Projects</strong> (vs 3 on Starter)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#43D6B0] shrink-0" />
              <span><strong>Custom Logo &amp; Studio Branding</strong> on Portals &amp; Invoices</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#43D6B0] shrink-0" />
              <span><strong>Automated Payment Reminders</strong> &amp; Dynamic Schedules</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#43D6B0] shrink-0" />
              <span><strong>50 Invoices / Month</strong> &amp; Multi-Currency Billing</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-[#43D6B0] shrink-0" />
              <span><strong>Approved Deliverable Trails</strong> &amp; Revision Tracking</span>
            </div>
          </div>
        </div>

        {/* Zero Auto Charge Guarantee */}
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#43D6B0] shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px] text-zinc-300">
            <strong className="text-white">100% Risk-Free Guarantee:</strong> No credit card was required to activate this 1-month gift. You decide whether to purchase the Standard Pack at any time from your Billing settings.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={handleViewPlans}
            disabled={dismissing}
            className="text-xs text-zinc-400 hover:text-white transition-colors underline underline-offset-4"
          >
            View Standard Pack Pricing
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="primary"
              onClick={handleDismiss}
              disabled={dismissing}
              className="w-full sm:w-auto bg-[#43D6B0] hover:bg-[#43D6B0]/90 text-zinc-950 font-bold px-5"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Start Using Free Standard Pack
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
