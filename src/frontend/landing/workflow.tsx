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
    <section id="workflow" className="py-24 px-6 lg:px-12 bg-[#0A0A0A] border-y border-[#2A2A2A] relative z-10 overflow-hidden">
      {/* Background Flowing Light Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-[#0047AB]/[0.04] rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto mb-16 space-y-4"
        >
          <span className="text-xs sm:text-[13px] font-mono uppercase tracking-widest text-[#E8F0FF] bg-[#0047AB]/20 px-4 py-1.5 rounded-full border border-[#2563EB]/30 font-semibold">
            Lifecycle Blueprint
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-[50px] font-extrabold text-white tracking-tight leading-tight">
            From Client Onboarding to Payment — One Connected Workflow
          </h2>
          <p className="text-lg sm:text-xl lg:text-[22px] text-zinc-300 max-w-3xl mx-auto leading-relaxed font-normal">
            Move every project forward with a structured process that keeps you and your clients aligned at every stage.
          </p>
        </motion.div>

        {/* Step Tabs Row */}
        <div className="relative mb-10">
          {/* Progress Connecting Line on Desktop */}
          <div className="hidden lg:block absolute top-[44px] left-8 right-8 h-0.5 bg-[#181818] -z-0">
            <motion.div
              className="h-full bg-gradient-to-r from-[#0047AB] to-[#2563EB] shadow-[0_0_12px_rgba(37,99,235,0.8)]"
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
                      ? 'bg-[#181818] border-[#2563EB]/50 shadow-[0_10px_30px_rgba(0,71,171,0.25)] ring-1 ring-[#2563EB]/40'
                      : 'bg-[#111111]/70 border-[#2A2A2A] hover:border-[#2563EB]/30 hover:bg-[#181818]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition-colors ${
                          isActive
                            ? 'bg-[#0047AB] text-white shadow-[0_0_16px_rgba(37,99,235,0.7)]'
                            : 'bg-[#181818] text-zinc-300 border border-[#2A2A2A]'
                        }`}
                      >
                        {step.icon}
                      </div>
                      <span className="text-xs font-mono text-zinc-300 font-bold">0{idx + 1}</span>
                    </div>

                    <h4 className="text-base sm:text-[17px] font-bold text-white tracking-tight mb-1">{step.label}</h4>
                    <p className="text-xs sm:text-sm text-zinc-300 leading-normal line-clamp-2">{step.desc}</p>
                  </div>

                  <div className="mt-4 pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase text-zinc-400 font-semibold">{step.stage}</span>
                    {isActive && <ArrowRight className="w-4 h-4 text-white" />}
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
            className="p-6 sm:p-9 rounded-2xl bg-[#111111]/90 border border-[#2A2A2A] backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0047AB] text-white flex items-center justify-center font-bold shrink-0 shadow-lg shadow-[#0047AB]/25">
                {steps[activeStep].icon}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono uppercase text-[#E8F0FF] bg-[#0047AB]/20 px-3.5 py-1 rounded-full border border-[#2563EB]/30 font-semibold">
                    {steps[activeStep].stage}
                  </span>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1 font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    {steps[activeStep].featureTag}
                  </span>
                  <span className="text-xs sm:text-sm text-zinc-400 font-mono">Stage {activeStep + 1} of 7</span>
                </div>
                <h3 className="text-2xl sm:text-3xl lg:text-[32px] font-bold text-white tracking-tight">{steps[activeStep].title}</h3>
                <p className="text-base sm:text-lg lg:text-xl text-zinc-300 max-w-3xl leading-relaxed">
                  {steps[activeStep].detail}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-center shrink-0">
              <button
                type="button"
                onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : steps.length - 1))}
                className="px-5 py-3 rounded-xl bg-[#181818] border border-[#2A2A2A] text-base text-zinc-300 hover:text-white hover:border-[#0047AB]/40 transition-colors flex items-center gap-2 font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </button>
              <button
                type="button"
                onClick={() => setActiveStep((prev) => (prev < steps.length - 1 ? prev + 1 : 0))}
                className="px-5 py-3 rounded-xl bg-[#0047AB] hover:bg-[#003A8C] text-white font-semibold text-base transition-colors shadow-md shadow-[#0047AB]/25 flex items-center gap-2"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};
