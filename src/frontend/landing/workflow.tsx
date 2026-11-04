import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserPlus,
  Layers,
  FolderKanban,
  CheckCircle2,
  Receipt,
  CreditCard,
  Eye,
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
      icon: <Eye className="w-4 h-4" />,
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
    <section id="workflow" className="py-24 px-6 lg:px-12 bg-[#101312] border-y border-[#176B5B]/30 relative z-10 overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto mb-16 space-y-4"
        >
          <span className="text-xs sm:text-[13px] font-mono uppercase tracking-widest text-[#43D6B0] bg-[#191F1D] px-4 py-1.5 rounded-full border border-[#176B5B]/40 font-medium">
            Lifecycle Blueprint
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-[50px] font-extrabold text-[#F5F5F0] tracking-tight leading-tight">
            From Client Onboarding to Payment — One Connected Workflow
          </h2>
          <p className="text-lg sm:text-xl lg:text-[22px] text-[#A6B4AE] max-w-3xl mx-auto leading-relaxed font-normal">
            Move every project forward with a structured process that keeps you and your clients aligned at every stage.
          </p>
        </motion.div>

        {/* Step Tabs Row */}
        <div className="relative mb-10">
          {/* Progress Connecting Line on Desktop - Staged in dedicated lower layer */}
          <div className="hidden lg:block absolute top-[34px] left-[5%] right-[5%] h-0.5 bg-[#191F1D] z-0 pointer-events-none overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#176B5B] to-[#43D6B0]"
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
                  className={`p-4 rounded-2xl border transition-all duration-300 text-left flex flex-col justify-between relative z-10 ${
                    isActive
                      ? 'bg-[#191F1D] border-[#43D6B0]/70 shadow-lg shadow-black/40 ring-1 ring-[#43D6B0]/40'
                      : 'bg-[#101312] border-[#176B5B]/30 hover:border-[#43D6B0]/40 hover:bg-[#191F1D]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition-colors ${
                          isActive
                            ? 'bg-[#43D6B0] text-[#101312]'
                            : 'bg-[#191F1D] text-[#A6B4AE] border border-[#176B5B]/30'
                        }`}
                      >
                        {step.icon}
                      </div>
                      <span className="text-xs font-mono text-[#A6B4AE] font-semibold">0{idx + 1}</span>
                    </div>

                    <h4 className="text-base sm:text-[17px] font-bold text-[#F5F5F0] tracking-tight mb-1">{step.label}</h4>
                    <p className="text-xs sm:text-sm text-[#A6B4AE] leading-normal line-clamp-2">{step.desc}</p>
                  </div>

                  <div className="mt-4 pt-2 border-t border-[#176B5B]/20 flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase text-[#A6B4AE] font-semibold">{step.stage}</span>
                    {isActive && <ArrowRight className="w-4 h-4 text-[#43D6B0]" />}
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
            className="p-6 sm:p-9 rounded-2xl bg-[#191F1D] border border-[#176B5B]/40 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#43D6B0] text-[#101312] flex items-center justify-center font-bold shrink-0 shadow-md">
                {steps[activeStep].icon}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono uppercase text-[#43D6B0] bg-[#176B5B]/20 px-3.5 py-1 rounded-full border border-[#176B5B]/40 font-semibold">
                    {steps[activeStep].stage}
                  </span>
                  <span className="text-xs font-mono text-[#43D6B0] bg-[#176B5B]/15 px-3.5 py-1 rounded-full border border-[#176B5B]/30 flex items-center gap-1 font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    {steps[activeStep].featureTag}
                  </span>
                  <span className="text-xs sm:text-sm text-[#A6B4AE] font-mono">Stage {activeStep + 1} of 7</span>
                </div>
                <h3 className="text-2xl sm:text-3xl lg:text-[32px] font-bold text-[#F5F5F0] tracking-tight">{steps[activeStep].title}</h3>
                <p className="text-base sm:text-lg lg:text-xl text-[#A6B4AE] max-w-3xl leading-relaxed">
                  {steps[activeStep].detail}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-center shrink-0">
              <button
                type="button"
                onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : steps.length - 1))}
                className="px-5 py-3 rounded-xl bg-[#101312] border border-[#176B5B]/40 text-base text-[#A6B4AE] hover:text-[#F5F5F0] hover:border-[#43D6B0]/50 transition-colors flex items-center gap-2 font-medium"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </button>
              <button
                type="button"
                onClick={() => setActiveStep((prev) => (prev < steps.length - 1 ? prev + 1 : 0))}
                className="px-5 py-3 rounded-xl bg-[#43D6B0] hover:bg-[#38c29e] text-[#101312] font-bold text-base transition-colors shadow-sm flex items-center gap-2"
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
