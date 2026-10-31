'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Users, FolderKanban, CheckSquare, GitFork, Receipt, ShieldCheck } from 'lucide-react';

export const FeatureShowcase: React.FC = () => {
  const features = [
    {
      icon: <Users className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Dedicated Client Workspaces',
      description: 'Keep each client, their projects, conversation notes, and documents organized in its own isolated workspace.',
      benefit: 'Replaces scattered Slack, WhatsApp, and email threads.',
    },
    {
      icon: <CheckSquare className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Deliverables & Version Control',
      description: 'Share work with clear version tags and release changelogs so clients always review the latest approved file.',
      benefit: 'Replaces lost Google Drive and Dropbox file links.',
    },
    {
      icon: <GitFork className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Formal Approvals & Sign-Offs',
      description: 'Collect explicit client approvals or structured revision requests tied directly to specific deliverable versions.',
      benefit: 'Eliminates endless scope creep and ambiguous verbal feedback.',
    },
    {
      icon: <Receipt className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Itemized Invoicing & Settlements',
      description: 'Generate client-ready invoices with flexible taxes, discounts, multi-currency support, and crisp PDF exports.',
      benefit: 'Replaces manual spreadsheet calculations and payment chasing.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Dedicated Client Portal',
      description: 'Clients connect via secure invitation links to a branded portal to review deliverables, approve milestones, and track invoices with verified access.',
      benefit: 'Fast, seamless onboarding with a professional, authenticated client experience.',
    },
    {
      icon: <FolderKanban className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Project Milestones & Budgets',
      description: 'Track phases, deadlines, deliverables, and financial budget allocation in one unified view.',
      benefit: 'Stay ahead of upcoming deadlines with complete clarity.',
    },
  ];

  return (
    <section id="features" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-3xl mx-auto mb-14 space-y-3"
      >
        <h2 className="text-3xl sm:text-5xl font-extrabold text-[#F8F9FA] tracking-tight leading-tight">
          Everything You Need to Run Client Work
        </h2>
        <p className="text-base sm:text-lg text-[#9CA3AF] max-w-2xl mx-auto leading-relaxed">
          One unified system connecting client management, deliverable reviews, invoicing, and payment tracking.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col justify-between p-7 rounded-2xl bg-[#16181B] border border-white/[0.08] hover:border-[#43D6B0]/40 transition-colors duration-200"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[#43D6B0] flex items-center justify-center mb-5">
                {feat.icon}
              </div>
              <h3 className="text-xl font-bold text-[#F8F9FA] tracking-tight mb-2.5">
                {feat.title}
              </h3>
              <p className="text-sm text-[#9CA3AF] leading-relaxed mb-6 font-normal">
                {feat.description}
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.08]">
              <span className="text-xs text-[#43D6B0] font-medium leading-normal block">
                {feat.benefit}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
