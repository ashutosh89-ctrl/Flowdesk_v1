import React from 'react';
import { motion } from 'motion/react';
import { XCircle, CheckCircle2 } from 'lucide-react';

export const BenefitsSection: React.FC = () => {
  const replacements = [
    {
      oldTool: 'Scattered Email & Slack Threads',
      replacedBy: 'Centralized client communication and in-context revision discussions.',
    },
    {
      oldTool: 'Unclear Deliverable Feedback',
      replacedBy: 'Organized version control with structured client approval sign-offs.',
    },
    {
      oldTool: 'Lost Project Files & Briefs',
      replacedBy: 'Dedicated client document vaults with clear onboarding request slots.',
    },
    {
      oldTool: 'Manual Spreadsheets & Tracking',
      replacedBy: 'Unified timeline tracking milestones, deliverables, and budgets.',
    },
    {
      oldTool: 'Messy Invoicing & Payment Chasing',
      replacedBy: 'Itemized professional invoices with tax calculations and payment tracking.',
    },
    {
      oldTool: 'Disconnected Single-Purpose Tools',
      replacedBy: 'One connected workspace from initial client intake to final payment.',
    },
  ];

  return (
    <section id="benefits" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-3xl mx-auto mb-16 space-y-4"
      >
        <span className="text-xs sm:text-[13px] font-mono uppercase tracking-widest text-[#E8F0FF] bg-[#0047AB]/20 px-4 py-1.5 rounded-full border border-[#2563EB]/30 font-semibold">
          Why FlowDesk
        </span>
        <h2 className="text-4xl sm:text-5xl lg:text-[50px] font-extrabold text-white tracking-tight leading-tight">
          Less Administrative Work. More Time for Great Work.
        </h2>
        <p className="text-lg sm:text-xl lg:text-[22px] text-zinc-300 max-w-3xl mx-auto leading-relaxed font-normal">
          Replace scattered tools, disconnected conversations, and manual tracking with one organized freelance workspace.
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
            className="p-6 sm:p-8 rounded-2xl bg-[#111111]/70 border border-[#2A2A2A] backdrop-blur-xl flex flex-col justify-between gap-5 hover:border-[#0047AB]/50 hover:bg-[#111111] transition-all hover:-translate-y-1 shadow-lg group"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm sm:text-base font-medium text-zinc-400 line-through">
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-500 shrink-0" />
                <span>{item.oldTool}</span>
              </div>
              <div className="flex items-start gap-3 text-lg sm:text-xl font-bold text-white leading-snug">
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#2563EB] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <span>{item.replacedBy}</span>
              </div>
            </div>
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              FlowDesk Workspace
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
