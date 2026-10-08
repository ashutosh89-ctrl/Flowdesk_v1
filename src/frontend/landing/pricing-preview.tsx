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
    { title: 'Client Workspaces', icon: <Users className="w-4 h-4 text-white" />, desc: 'Keep client details, projects, deliverables, and invoices organized together.' },
    { title: 'Projects', icon: <FolderKanban className="w-4 h-4 text-white" />, desc: 'Track project scope, progress, timelines, and important work details.' },
    { title: 'Deliverables', icon: <CheckSquare className="w-4 h-4 text-white" />, desc: 'Manage files, versions, review status, approvals, and revisions.' },
    { title: 'Approvals & Revisions', icon: <Sparkles className="w-4 h-4 text-white" />, desc: 'Keep client feedback connected to the deliverable being reviewed.' },
    { title: 'Documents', icon: <FileText className="w-4 h-4 text-white" />, desc: 'Organize project files and requested documents in their relevant workspace.' },
    { title: 'Invoicing', icon: <Receipt className="w-4 h-4 text-white" />, desc: 'Create professional itemized invoices with configurable tax and currency options.' },
    { title: 'Multi-Currency', icon: <Printer className="w-4 h-4 text-white" />, desc: 'Create invoices using supported currencies and display amounts consistently.' },
    { title: 'Client Portal', icon: <ShieldCheck className="w-4 h-4 text-white" />, desc: 'Give clients a dedicated place to review work, documents, and invoices.' },
    { title: 'Comments', icon: <MessageSquare className="w-4 h-4 text-white" />, desc: 'Keep project and deliverable discussions connected to the relevant work.' },
    { title: 'Activity', icon: <Activity className="w-4 h-4 text-white" />, desc: 'See a chronological history of important workspace activity.' },
  ];

  return (
    <section id="pricing" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto relative overflow-hidden z-10">
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-3xl mx-auto mb-12 space-y-4"
      >
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 bg-white/5 px-3.5 py-1 rounded-full border border-white/10">
          Transparent Pricing
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Simple plans that scale with your client work.
        </h2>
        <p className="text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Start for free, then upgrade to unlock higher client capacity, automated payment reminders, and branded client portals.
        </p>

        {/* Interval Selector */}
        <div className="pt-4 flex justify-center">
          <div className="inline-flex items-center p-1 bg-zinc-900 border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                interval === 'monthly'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setInterval('yearly')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                interval === 'yearly'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>Yearly Billing</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-mono">
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

          return (
            <motion.div
              key={planKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`flex flex-col justify-between p-6 sm:p-8 rounded-3xl border transition-all ${
                isPopular
                  ? 'bg-zinc-900/90 border-emerald-500/40 shadow-[0_20px_60px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
                  : 'bg-zinc-900/60 border-white/10 hover:border-white/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-white tracking-tight">{plan.name}</h3>
                  {plan.badge && (
                    <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed mb-6 min-h-[36px]">
                  {plan.tagline}
                </p>

                <div className="mb-6 pb-6 border-b border-white/10">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                      ₹{price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      /{interval === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono mt-1 block">
                    {price > 0 ? '+ 18% GST (Tax Invoice Included)' : 'Free forever'}
                  </span>
                </div>

                <ul className="space-y-3 text-xs text-zinc-300 mb-8">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Button
                  variant={isPopular ? 'primary' : 'secondary'}
                  size="lg"
                  className={`w-full ${
                    isPopular ? 'shadow-[0_0_24px_rgba(16,185,129,0.3)]' : ''
                  }`}
                  onClick={() => onOpenAuth('signup')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {planKey === 'free' ? 'Get Started Free' : `Start with ${plan.name}`}
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
        className="relative rounded-3xl p-8 sm:p-12 border border-white/20 bg-zinc-900/85 backdrop-blur-3xl shadow-[0_30px_90px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-8 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white border border-white/15 text-xs font-mono mb-3">
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>Complete Freelance Workspace</span>
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              All tools included across all plans
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-xl">
              Core freelance workflow features are available on every plan. Higher tiers increase capacity limits.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={() => onOpenAuth('signup')}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Create Free Account
          </Button>
        </div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-8">
          {capabilities.map((cap, idx) => (
            <div
              key={idx}
              className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/25 hover:bg-white/[0.06] transition-all duration-300"
            >
              <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                {cap.icon}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white tracking-tight">{cap.title}</h4>
                  <Check className="w-3.5 h-3.5 text-white shrink-0" />
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{cap.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Client data is protected by PostgreSQL Row Level Security and never deleted on payment failure.</span>
          </div>
          <span className="font-mono text-[11px] text-zinc-400">FlowDesk v1.0</span>
        </div>
      </motion.div>
    </section>
  );
};
