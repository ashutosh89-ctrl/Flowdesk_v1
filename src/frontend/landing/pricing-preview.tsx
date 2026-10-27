import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/frontend/shared/ui/button';
import { BILLING_PLANS, PlanKey, BillingInterval } from '@/shared/billing';
import {
  Check,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  FolderKanban,
  Users,
  CheckSquare,
  Receipt,
  FileText,
  Activity,
  MessageSquare,
  Printer,
} from 'lucide-react';

export interface PricingPreviewProps {
  onOpenAuth: (view: 'signup' | 'login') => void;
  onLaunchApp: () => void;
}

export const PricingPreview: React.FC<PricingPreviewProps> = ({ onOpenAuth, onLaunchApp }) => {
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  const capabilities = [
    { title: 'Client Workspaces', icon: <Users className="w-4 h-4 text-white" />, desc: 'Dedicated hubs for client details, projects, deliverables, and billing.' },
    { title: 'Projects & Milestones', icon: <FolderKanban className="w-4 h-4 text-white" />, desc: 'Track project scope, progress, delivery timelines, and budget details.' },
    { title: 'Deliverable Versions', icon: <CheckSquare className="w-4 h-4 text-white" />, desc: 'Organize files with version labels, review status, and full changelogs.' },
    { title: 'Approvals & Revisions', icon: <Sparkles className="w-4 h-4 text-white" />, desc: 'Structured client feedback tied directly to the specific work being reviewed.' },
    { title: 'Document Vaults', icon: <FileText className="w-4 h-4 text-white" />, desc: 'Store contracts, briefs, and client onboarding files in one secure repository.' },
    { title: 'Professional Invoicing', icon: <Receipt className="w-4 h-4 text-white" />, desc: 'Itemized invoices with custom tax rates, discounts, and clear payment terms.' },
    { title: 'Multi-Currency Billing', icon: <Printer className="w-4 h-4 text-white" />, desc: 'Issue invoices and receive payments in USD, INR, EUR, GBP, and more.' },
    { title: 'Client Review Portal', icon: <ShieldCheck className="w-4 h-4 text-white" />, desc: 'Password-free magic link portal for clients to review work, files, and invoices.' },
    { title: 'Threaded Discussions', icon: <MessageSquare className="w-4 h-4 text-white" />, desc: 'Keep project and deliverable conversations connected to the relevant work.' },
    { title: 'Activity History', icon: <Activity className="w-4 h-4 text-white" />, desc: 'A transparent chronological audit trail of all workspace milestones and updates.' },
  ];

  return (
    <section id="pricing" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto relative overflow-hidden z-10">
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-3xl mx-auto mb-14 space-y-4"
      >
        <span className="text-xs sm:text-[13px] font-mono uppercase tracking-widest text-[#43D6B0] bg-[#191F1D] px-4 py-1.5 rounded-full border border-[#176B5B]/40 font-medium">
          Transparent Pricing
        </span>
        <h2 className="text-4xl sm:text-5xl lg:text-[50px] font-extrabold text-[#F5F5F0] tracking-tight leading-tight">
          Plans That Grow With Your Freelance Business
        </h2>
        <p className="text-lg sm:text-xl lg:text-[22px] text-[#A6B4AE] max-w-3xl mx-auto leading-relaxed font-normal">
          Start with the essentials. Upgrade when your clients, projects, and business grow.
        </p>

        {/* Interval Selector */}
        <div className="pt-4 flex justify-center">
          <div className="inline-flex items-center p-1.5 bg-[#191F1D] border border-[#176B5B]/30 rounded-xl">
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              className={`px-6 py-2.5 rounded-lg text-base font-semibold transition-all ${
                interval === 'monthly'
                  ? 'bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/50 shadow-sm'
                  : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setInterval('yearly')}
              className={`flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-base font-semibold transition-all ${
                interval === 'yearly'
                  ? 'bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/50 shadow-sm'
                  : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
              }`}
            >
              <span>Yearly Billing</span>
              <span className="text-xs bg-[#176B5B]/25 text-[#43D6B0] border border-[#176B5B]/35 px-2 py-0.5 rounded-full font-mono font-medium">
                Save ~16%
              </span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* 3-Column Plan Cards Sourced from BILLING_PLANS with Equal Hierarchy */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {(['free', 'pro', 'studio'] as PlanKey[]).map((planKey) => {
          const plan = BILLING_PLANS[planKey];
          const price = plan.pricing[interval].INR;
          const ctaLabel =
            planKey === 'free'
              ? 'Start for Free'
              : planKey === 'pro'
              ? 'Upgrade to Pro'
              : 'Choose Studio';

          return (
            <motion.div
              key={planKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="group flex flex-col justify-between p-6 sm:p-9 rounded-3xl bg-[#191F1D] border border-[#176B5B]/30 shadow-lg shadow-black/30 hover:border-[#43D6B0]/70 hover:shadow-[0_16px_40px_rgba(0,0,0,0.6),0_0_0_1px_rgba(67,214,176,0.3)] hover:-translate-y-1 focus-within:border-[#43D6B0] focus-within:ring-2 focus-within:ring-[#43D6B0]/30 transition-all duration-200 ease-out"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl sm:text-3xl font-bold text-[#F5F5F0] tracking-tight">{plan.name}</h3>
                </div>

                <p className="text-base text-[#A6B4AE] leading-relaxed mb-6 min-h-[50px] font-normal">
                  {plan.tagline}
                </p>

                <div className="mb-6 pb-6 border-b border-[#176B5B]/25">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl lg:text-[46px] font-extrabold text-[#F5F5F0] tracking-tight">
                      ₹{price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-base text-[#A6B4AE] font-mono">
                      /{interval === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm text-[#A6B4AE] font-mono mt-1.5 block">
                    {price > 0 ? '+ 18% GST (Tax Invoice Included)' : 'Free forever'}
                  </span>
                </div>

                <ul className="space-y-3.5 text-base text-[#A6B4AE] mb-8 font-normal">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-5 h-5 text-[#43D6B0] shrink-0 mt-0.5" />
                      <span className="leading-snug text-[#A6B4AE] group-hover:text-[#F5F5F0] transition-colors">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full text-base sm:text-lg font-semibold py-4 bg-[#101312] text-[#F5F5F0] border border-[#176B5B]/40 group-hover:bg-[#43D6B0] group-hover:text-[#101312] group-hover:border-[#43D6B0] group-hover:font-bold group-focus-within:bg-[#43D6B0] group-focus-within:text-[#101312] group-focus-within:border-[#43D6B0] transition-all duration-200"
                  onClick={() => onOpenAuth('signup')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {ctaLabel}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Capabilities Overview Section */}
      <motion.div
        initial={{ opacity: 0, y: 28, filter: 'blur(4px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: false, amount: 0.15 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-3xl p-8 sm:p-12 border border-[#176B5B]/35 bg-[#191F1D] shadow-2xl overflow-hidden"
      >
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-8 border-b border-[#176B5B]/30">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#176B5B]/20 text-[#43D6B0] border border-[#176B5B]/35 text-xs sm:text-sm font-mono mb-3 font-semibold">
              <Sparkles className="w-4 h-4 text-[#43D6B0]" />
              <span>Complete Freelance Workspace</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-[#F5F5F0] tracking-tight">
              Everything Your Freelance Business Needs. One Workspace.
            </h3>
            <p className="text-base sm:text-lg text-[#A6B4AE] mt-2 max-w-xl leading-relaxed font-normal">
              From client management to payment tracking, access the tools you need to keep your entire business running smoothly.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="text-base sm:text-lg font-bold px-8 py-4 shadow-md shrink-0"
            onClick={() => onOpenAuth('signup')}
            rightIcon={<ArrowRight className="w-5 h-5" />}
          >
            Create Free Workspace
          </Button>
        </div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-8">
          {capabilities.map((cap, idx) => (
            <div
              key={idx}
              className="flex items-start gap-4 p-4 sm:p-5 rounded-2xl bg-[#101312] border border-[#176B5B]/30 hover:border-[#43D6B0]/40 hover:bg-[#141A18] transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-xl bg-[#176B5B]/20 border border-[#176B5B]/35 text-[#43D6B0] flex items-center justify-center shrink-0 mt-0.5">
                {cap.icon}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg sm:text-xl font-bold text-[#F5F5F0] tracking-tight">{cap.title}</h4>
                  <Check className="w-4 h-4 text-[#43D6B0] shrink-0" />
                </div>
                <p className="text-base text-[#A6B4AE] leading-relaxed font-normal">{cap.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 mt-8 pt-6 border-t border-[#176B5B]/25 flex flex-col sm:flex-row items-center justify-between text-sm text-[#A6B4AE] gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#43D6B0] shrink-0" />
            <span>Client data is protected by strict workspace isolation and never deleted on payment failure.</span>
          </div>
          <span className="font-mono text-xs text-[#A6B4AE]">FlowDesk v1.0</span>
        </div>
      </motion.div>
    </section>
  );
};
