import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserPlus,
  Layers,
  FolderKanban,
  CheckCircle2,
  Receipt,
  CreditCard,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  FileText,
} from 'lucide-react';

export const WorkflowSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      id: 'client',
      label: 'Client',
      stage: '01. ONBOARD',
      title: 'Dedicated Client Workspace',
      icon: <UserPlus className="w-4 h-4" />,
      desc: 'Bring clients into an organized workspace.',
      detail:
        'Create a dedicated client workspace with verified contact details, communication channels, and secure portal access.',
      featureTag: 'Workspace Isolation',
    },
    {
      id: 'project',
      label: 'Project',
      stage: '02. SCOPE',
      title: 'Project Milestones & Timeline',
      icon: <FolderKanban className="w-4 h-4" />,
      desc: 'Define scope, deadlines, and budgets.',
      detail:
        'Structure project phases, set target delivery dates, track budgets, and link deliverables directly to client milestones.',
      featureTag: 'Structured Scoping',
    },
    {
      id: 'deliverables',
      label: 'Deliverables',
      stage: '03. ITERATE',
      title: 'Deliverables & Version History',
      icon: <CheckCircle2 className="w-4 h-4" />,
      desc: 'Share work with clear version control.',
      detail:
        'Upload project files with version tags and changelog notes so clients always review the current, authoritative asset package.',
      featureTag: 'Version Control',
    },
    {
      id: 'approval',
      label: 'Approval',
      stage: '04. SIGN-OFF',
      title: 'Formal Approvals & Revisions',
      icon: <Sparkles className="w-4 h-4" />,
      desc: 'Structured feedback and sign-offs.',
      detail:
        'Clients review work in their private portal to submit formal approvals or itemized revision requests connected to specific versions.',
      featureTag: 'Portal Reviews',
    },
    {
      id: 'invoice',
      label: 'Invoice',
      stage: '05. BILLING',
      title: 'Itemized Invoicing & PDF Export',
      icon: <Receipt className="w-4 h-4" />,
      desc: 'Generate clear, professional invoices.',
      detail:
        'Create itemized invoices matching approved deliverables with configurable tax rates, multi-currency support, and crisp PDF exports.',
      featureTag: 'Tax & Multi-Currency',
    },
    {
      id: 'payment',
      label: 'Payment',
      stage: '06. SETTLE',
      title: 'Payment Tracking & Reconciliation',
      icon: <CreditCard className="w-4 h-4" />,
      desc: 'Record payments and monitor balances.',
      detail:
        'Track payment status, record offline settlements, calculate remaining balances, and maintain an organized financial record.',
      featureTag: 'Balance Tracking',
    },
    {
      id: 'complete',
      label: 'Archive',
      stage: '07. COMPLETE',
      title: 'Project History & Client Retention',
      icon: <Layers className="w-4 h-4" />,
      desc: 'Preserve full timeline for future work.',
      detail:
        'Maintain a searchable historical record of approvals, documents, and payments ready whenever the client re-engages for new projects.',
      featureTag: 'Persistent History',
    },
  ];

  return (
    <section id="workflow" className="py-24 px-6 lg:px-12 bg-zinc-950/70 border-y border-white/10 relative z-10 overflow-hidden">
      {/* Background Flowing Light Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-white/[0.02] rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto mb-16 space-y-4"
        >
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
            The Freelance Lifecycle
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            A structured workflow from kickoff to payment.
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Move projects smoothly through an intuitive sequence designed specifically for independent client work.
          </p>
        </motion.div>

        {/* Step Tabs Row */}
        <div className="relative mb-10">
          {/* Progress Connecting Line on Desktop */}
          <div className="hidden lg:block absolute top-[44px] left-8 right-8 h-0.5 bg-white/10 -z-0">
            <motion.div
              className="h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]"
              initial={{ width: '0%' }}
              animate={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 relative z-10">
            {steps.map((step, idx) => {
              const isActive = idx === activeStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(idx)}
                  className={`p-4 rounded-2xl border transition-all duration-300 text-left flex flex-col justify-between ${
                    isActive
                      ? 'bg-zinc-900 border-white/40 shadow-[0_10px_30px_rgba(255,255,255,0.1)] ring-1 ring-white/20'
                      : 'bg-zinc-950/80 border-white/10 hover:border-white/20 hover:bg-zinc-900/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition-colors ${
                          isActive
                            ? 'bg-white text-zinc-950 shadow-[0_0_16px_rgba(255,255,255,0.5)]'
                            : 'bg-white/10 text-white border border-white/10'
                        }`}
                      >
                        {step.icon}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">0{idx + 1}</span>
                    </div>

                    <h4 className="text-xs font-bold text-white tracking-tight mb-1">{step.label}</h4>
                    <p className="text-[10px] text-zinc-400 leading-normal line-clamp-2">{step.desc}</p>
                  </div>

                  <div className="mt-4 pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[9px] font-mono text-zinc-400">{step.stage}</span>
                    {isActive && <ArrowRight className="w-3 h-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Stage Detailed Showcase Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="p-6 sm:p-8 rounded-2xl bg-zinc-900/80 border border-white/15 backdrop-blur-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white text-zinc-950 flex items-center justify-center font-bold shrink-0 shadow-lg">
                {steps[activeStep].icon}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase text-zinc-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                    {steps[activeStep].stage}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {steps[activeStep].featureTag}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">Step {activeStep + 1} of 7</span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">{steps[activeStep].title}</h3>
                <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl leading-relaxed">
                  {steps[activeStep].detail}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              <button
                type="button"
                onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : steps.length - 1))}
                className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <button
                type="button"
                onClick={() => setActiveStep((prev) => (prev < steps.length - 1 ? prev + 1 : 0))}
                className="px-4 py-2 rounded-xl bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors shadow-md flex items-center gap-1.5"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};
