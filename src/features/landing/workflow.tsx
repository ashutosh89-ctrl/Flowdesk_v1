import React from 'react';
import { ArrowDown, ArrowRight, UserPlus, Layers, FolderKanban, CheckCircle2, Receipt, CreditCard, Sparkles } from 'lucide-react';

export const WorkflowSection: React.FC = () => {
  const steps = [
    { label: 'Client', icon: <UserPlus className="w-4 h-4" />, desc: 'Onboard client account' },
    { label: 'Workspace', icon: <Layers className="w-4 h-4" />, desc: 'Set up isolated hub' },
    { label: 'Project', icon: <FolderKanban className="w-4 h-4" />, desc: 'Define budget & timeline' },
    { label: 'Deliverables', icon: <CheckCircle2 className="w-4 h-4" />, desc: 'Submit for formal approval' },
    { label: 'Invoice', icon: <Receipt className="w-4 h-4" />, desc: 'Auto-generate invoice' },
    { label: 'Payment', icon: <CreditCard className="w-4 h-4" />, desc: 'Track settlement' },
    { label: 'Project Complete', icon: <Sparkles className="w-4 h-4" />, desc: 'Archive & log analytics' },
  ];

  return (
    <section id="workflow" className="py-20 px-6 lg:px-12 bg-zinc-950/60 border-y border-white/10">
      <div className="max-w-7xl mx-auto text-center space-y-4 mb-16">
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">The Flow Desk Lifecycle</span>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Deliberate flow from onboarding to payment settlement.
        </h2>
        <p className="text-sm text-zinc-400 max-w-xl mx-auto">
          Every client project follows a structured, friction-free pipeline that guarantees transparency.
        </p>
      </div>

      {/* Desktop Horizontal Workflow Flowchart */}
      <div className="hidden lg:flex items-center justify-between gap-2 max-w-6xl mx-auto relative">
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-zinc-900/80 border border-white/10 backdrop-blur-xl w-36 shadow-lg group hover:border-white/30 transition-all hover:-translate-y-1">
              <div className="w-9 h-9 rounded-xl bg-white text-zinc-950 flex items-center justify-center mb-3 font-semibold shadow-md">
                {step.icon}
              </div>
              <h4 className="text-xs font-bold text-white tracking-tight">{step.label}</h4>
              <p className="text-[10px] text-zinc-400 mt-1 leading-tight">{step.desc}</p>
            </div>
            {idx < steps.length - 1 && (
              <ArrowRight className="w-5 h-5 text-zinc-600 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Mobile Vertical Flowchart */}
      <div className="flex lg:hidden flex-col items-center gap-3 max-w-sm mx-auto">
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/80 border border-white/10 w-full text-left">
              <div className="w-9 h-9 rounded-xl bg-white text-zinc-950 flex items-center justify-center shrink-0 font-semibold">
                {step.icon}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">{step.label}</h4>
                <p className="text-xs text-zinc-400">{step.desc}</p>
              </div>
            </div>
            {idx < steps.length - 1 && (
              <ArrowDown className="w-4 h-4 text-zinc-600" />
            )}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
};
