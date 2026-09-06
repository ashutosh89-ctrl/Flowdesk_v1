import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/frontend/shared/ui/button';
import { Check, ArrowRight, ShieldCheck, Sparkles, FolderKanban, Users, CheckSquare, Receipt, FileText, Activity, MessageSquare, Printer } from 'lucide-react';

export interface PricingPreviewProps {
  onOpenAuth: (view: 'signup' | 'login') => void;
  onLaunchApp: () => void;
}

export const PricingPreview: React.FC<PricingPreviewProps> = ({ onOpenAuth, onLaunchApp }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <section id="capabilities" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto relative overflow-hidden z-10">
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-3xl mx-auto mb-16 space-y-4"
      >
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 bg-white/5 px-3.5 py-1 rounded-full border border-white/10">
          FlowDesk v1
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Everything you need to run your freelance workflow.
        </h2>
        <p className="text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Manage client relationships, projects, deliverables, documents, approvals, invoices, and payment tracking from one organized workspace.
        </p>
      </motion.div>

      {/* Main Unified Workspace Capabilities Showcase Card */}
      <motion.div
        initial={{ opacity: 0, y: 28, filter: 'blur(4px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: false, amount: 0.15 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative rounded-3xl p-8 sm:p-12 border border-white/20 bg-zinc-900/85 backdrop-blur-3xl shadow-[0_30px_90px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.25)] overflow-hidden"
      >
        {/* Glass Cursor Radial Reflection */}
        {isHovered && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle 350px at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.08), transparent 70%)`,
            }}
          />
        )}

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 pb-10 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white border border-white/15 text-xs font-mono mb-3">
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>Complete Freelance Workspace</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Complete Workspace Capabilities
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 max-w-xl">
              All core tools are available to help you manage your freelance client work efficiently.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              variant="primary"
              size="lg"
              onClick={() => onOpenAuth('signup')}
              className="shadow-[0_0_24px_rgba(255,255,255,0.25)] hover:shadow-[0_0_36px_rgba(255,255,255,0.4)] transition-all duration-300"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Create Free Workspace
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => onOpenAuth('login')}
              className="hover:border-white/40 transition-all duration-300"
            >
              Sign In
            </Button>
          </div>
        </div>

        {/* 2-Column Responsive Capabilities Grid */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-10">
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

        {/* Footer Security & Architecture Note */}
        <div className="relative z-10 mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Your client work stays organized and access-controlled within its workspace.</span>
          </div>
          <span className="font-mono text-[11px] text-zinc-400">FlowDesk v1.0</span>
        </div>
      </motion.div>
    </section>
  );
};
