import React from 'react';
import { motion } from 'motion/react';
import { XCircle, CheckCircle2 } from 'lucide-react';

export const BenefitsSection: React.FC = () => {
  const replacements = [
    { oldTool: 'Scattered Client Conversations', replacedBy: 'Structured project comments and revision discussions.' },
    { oldTool: 'Lost Project Context', replacedBy: 'Keep important project activity connected to the work.' },
    { oldTool: 'Scattered Project Files', replacedBy: 'Keep client documents and requested files organized by workspace.' },
    { oldTool: 'Manual Project Tracking', replacedBy: 'Keep project progress, client work, and invoices together.' },
    { oldTool: 'Scattered Invoices', replacedBy: 'Create, organize, and track professional invoices in one place.' },
    { oldTool: 'Unclear Deliverable Versions', replacedBy: 'Keep versions, reviews, approvals, and revision requests connected.' },
  ];

  return (
    <section id="benefits" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-2xl mx-auto mb-16 space-y-4"
      >
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">Benefits</span>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Bring your freelance workflow into one place.
        </h2>
        <p className="text-sm text-zinc-400">
          Keep client work, project progress, deliverables, approvals, documents, and invoices connected instead of scattered across different tools.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {replacements.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: false, amount: 0.15 }}
            transition={{ duration: 0.5, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="p-6 rounded-2xl bg-zinc-900/60 border border-white/10 backdrop-blur-xl flex flex-col justify-between gap-4 hover:border-white/30 hover:bg-zinc-900/80 transition-all hover:-translate-y-1 shadow-lg group"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 line-through">
                <XCircle className="w-4 h-4 text-zinc-500 shrink-0" />
                <span>{item.oldTool}</span>
              </div>
              <div className="flex items-start gap-2 text-sm font-bold text-white">
                <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <span>{item.replacedBy}</span>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              FlowDesk Workspace
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
