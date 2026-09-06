import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  UserPlus,
  Layers,
  FileCheck,
  CheckCircle2,
  Receipt,
  CreditCard,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const TestimonialsSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: 'Client Added',
      icon: <UserPlus className="w-4 h-4" />,
      tag: '01. ONBOARD',
      desc: 'Create a client profile and keep their work organized in one place.',
      detail: 'Create a client profile, set communication preferences, and establish a dedicated workspace for all ongoing work.',
    },
    {
      title: 'Project Started',
      icon: <Layers className="w-4 h-4" />,
      tag: '02. SETUP',
      desc: 'Set the scope, timeline, budget, and project details.',
      detail: 'Define project milestones, allocate budgets, set target deadlines, and organize project deliverables.',
    },
    {
      title: 'Documents Organized',
      icon: <FileCheck className="w-4 h-4" />,
      tag: '03. REPOSITORY',
      desc: 'Keep requested files and project documents connected to the right client work.',
      detail: 'Store agreements, briefs, and brand assets in the client workspace with clear document request slots.',
    },
    {
      title: 'Work Submitted',
      icon: <CheckCircle2 className="w-4 h-4" />,
      tag: '04. SUBMIT',
      desc: 'Share deliverables with version history and a clear review status.',
      detail: 'Upload deliverable files with version labels and notes so clients can easily review the latest progress.',
    },
    {
      title: 'Client Review',
      icon: <Sparkles className="w-4 h-4" />,
      tag: '05. REVIEW',
      desc: 'Clients can approve work or request revisions with clear feedback.',
      detail: 'Clients review deliverables in their portal to sign off approvals or submit structured revision requests.',
    },
    {
      title: 'Invoice Created',
      icon: <Receipt className="w-4 h-4" />,
      tag: '06. BILLING',
      desc: 'Create a professional invoice with the correct line items, tax, currency, and totals.',
      detail: 'Generate an itemized invoice matching completed project work with configurable tax rates and PDF export.',
    },
    {
      title: 'Payment Recorded',
      icon: <CreditCard className="w-4 h-4" />,
      tag: '07. PAYMENT',
      desc: 'Track outstanding balances and record payments as work moves toward completion.',
      detail: 'Record payments received from clients, track outstanding balances, and maintain an organized financial record.',
    },
  ];

  return (
    <section className="py-24 px-6 lg:px-12 bg-zinc-950/70 border-y border-white/10 relative overflow-hidden">
      {/* Background Flowing Light Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-white/[0.02] rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
            Lifecycle Blueprint
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            How FlowDesk Works
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            A structured workflow connecting client work from project kickoff to payment tracking.
          </p>
        </div>

        {/* Scrollable Horizontal Step Stream */}
        <div className="relative mb-12">
          {/* Progress Connecting Line */}
          <div className="hidden lg:block absolute top-[44px] left-8 right-8 h-0.5 bg-white/10 -z-0">
            <motion.div
              className="h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]"
              initial={{ width: '0%' }}
              whileInView={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 relative z-10">
            {steps.map((step, idx) => {
              const isActive = idx === activeStep;
              return (
                <motion.div
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
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
                      <span className="text-[9px] font-mono text-zinc-400">{idx + 1} / 7</span>
                    </div>

                    <h4 className="text-xs font-bold text-white tracking-tight mb-1">{step.title}</h4>
                    <p className="text-[10px] text-zinc-400 leading-normal line-clamp-2">{step.desc}</p>
                  </div>

                  <div className="mt-4 pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[9px] font-mono text-zinc-400">{step.tag}</span>
                    {isActive && <ArrowRight className="w-3 h-3 text-white" />}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Active Step Detailed Showcase Panel */}
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-6 sm:p-8 rounded-2xl bg-zinc-900/80 border border-white/15 backdrop-blur-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white text-zinc-950 flex items-center justify-center font-bold shrink-0 shadow-lg">
              {steps[activeStep].icon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono uppercase text-zinc-400 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                  {steps[activeStep].tag}
                </span>
                <span className="text-xs text-zinc-400 font-mono">Stage {activeStep + 1} of 7</span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">{steps[activeStep].title}</h3>
              <p className="text-xs sm:text-sm text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                {steps[activeStep].detail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              onClick={() => setActiveStep((prev) => (prev > 0 ? prev - 1 : steps.length - 1))}
              className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 hover:text-white hover:bg-white/10 transition-colors font-mono"
            >
              Prev
            </button>
            <button
              onClick={() => setActiveStep((prev) => (prev < steps.length - 1 ? prev + 1 : 0))}
              className="px-3 py-1.5 rounded-xl bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors shadow-md"
            >
              Next Step
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

