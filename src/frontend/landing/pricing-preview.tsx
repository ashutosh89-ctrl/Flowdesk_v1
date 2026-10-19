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
        <span className="text-xs sm:text-[13px] font-mono uppercase tracking-widest text-[#E8F0FF] bg-[#0047AB]/20 px-4 py-1.5 rounded-full border border-[#2563EB]/30 font-semibold">
          Transparent Pricing
        </span>
        <h2 className="text-4xl sm:text-5xl lg:text-[50px] font-extrabold text-white tracking-tight leading-tight">
          Plans That Grow With Your Freelance Business
        </h2>
        <p className="text-lg sm:text-xl lg:text-[22px] text-zinc-300 max-w-3xl mx-auto leading-relaxed font-normal">
          Start with the essentials. Upgrade when your clients, projects, and business grow.
        </p>

        {/* Interval Selector */}
        <div className="pt-4 flex justify-center">
          <div className="inline-flex items-center p-1.5 bg-[#111111] border border-[#2A2A2A] rounded-xl">
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              className={`px-6 py-2.5 rounded-lg text-base font-semibold transition-all ${
                interval === 'monthly'
                  ? 'bg-[#0047AB] text-white shadow-sm shadow-[#0047AB]/30'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setInterval('yearly')}
              className={`flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-base font-semibold transition-all ${
                interval === 'yearly'
                  ? 'bg-[#0047AB] text-white shadow-sm shadow-[#0047AB]/30'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <span>Yearly Billing</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono font-semibold">
                Save ~16%
              </span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* 3-Column Plan Cards Sourced from BILLING_PLANS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {(['free', 'pro', 'studio'] as PlanKey[]).map((planKey) => {
          const plan = BILLING_PLANS[planKey];
          const price = plan.pricing[interval].INR;
          const isPopular = planKey === 'pro';
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
              className={`flex flex-col justify-between p-6 sm:p-9 rounded-3xl border transition-all ${
                isPopular
                  ? 'bg-[#111111]/95 border-[#2563EB]/60 shadow-[0_20px_60px_rgba(0,71,171,0.25)] ring-1 ring-[#0047AB]/50'
                  : 'bg-[#111111]/70 border-[#2A2A2A] hover:border-[#0047AB]/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{plan.name}</h3>
                  {plan.badge && (
                    <span className="text-xs font-mono px-3.5 py-1 rounded-full bg-[#0047AB]/20 text-[#E8F0FF] border border-[#2563EB]/40 font-semibold">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <p className="text-base text-zinc-300 leading-relaxed mb-6 min-h-[50px] font-normal">
                  {plan.tagline}
                </p>

                <div className="mb-6 pb-6 border-b border-[#2A2A2A]">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl lg:text-[46px] font-extrabold text-white tracking-tight">
                      ₹{price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-base text-zinc-400 font-mono">
                      /{interval === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm text-zinc-400 font-mono mt-1.5 block">
                    {price > 0 ? '+ 18% GST (Tax Invoice Included)' : 'Free forever'}
                  </span>
                </div>

                <ul className="space-y-3.5 text-base text-zinc-300 mb-8 font-normal">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Button
                  variant={isPopular ? 'primary' : 'secondary'}
                  size="lg"
                  className={`w-full text-base sm:text-lg font-semibold py-4 ${
                    isPopular ? 'shadow-[0_0_24px_rgba(0,71,171,0.4)]' : ''
                  }`}
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
        className="relative rounded-3xl p-8 sm:p-12 border border-[#2A2A2A] bg-[#111111]/90 backdrop-blur-3xl shadow-[0_30px_90px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-8 border-b border-[#2A2A2A]">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#0047AB]/20 text-[#E8F0FF] border border-[#2563EB]/30 text-xs sm:text-sm font-mono mb-3 font-semibold">
              <Sparkles className="w-4 h-4 text-[#2563EB]" />
              <span>Complete Freelance Workspace</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Everything Your Freelance Business Needs. One Workspace.
            </h3>
            <p className="text-base sm:text-lg text-zinc-300 mt-2 max-w-xl leading-relaxed font-normal">
              From client management to payment tracking, access the tools you need to keep your entire business running smoothly.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="text-base sm:text-lg font-semibold px-8 py-4 shadow-md shadow-[#0047AB]/30 shrink-0"
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
              className="flex items-start gap-4 p-4 sm:p-5 rounded-2xl bg-[#181818]/60 border border-[#2A2A2A] hover:border-[#0047AB]/40 hover:bg-[#181818] transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-xl bg-[#0047AB]/15 border border-[#2563EB]/30 flex items-center justify-center shrink-0 mt-0.5">
                {cap.icon}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg sm:text-xl font-bold text-white tracking-tight">{cap.title}</h4>
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                </div>
                <p className="text-base text-zinc-300 leading-relaxed font-normal">{cap.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 mt-8 pt-6 border-t border-[#2A2A2A] flex flex-col sm:flex-row items-center justify-between text-sm text-zinc-400 gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Client data is protected by strict workspace isolation and never deleted on payment failure.</span>
          </div>
          <span className="font-mono text-xs text-zinc-400">FlowDesk v1.0</span>
        </div>
      </motion.div>
    </section>
  );
};
