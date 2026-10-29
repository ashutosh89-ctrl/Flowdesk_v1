import React from 'react';
import { motion } from 'motion/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Users, FolderKanban, FileText, CheckSquare, Receipt, ShieldCheck, Activity, GitFork } from 'lucide-react';

export const FeatureShowcase: React.FC = () => {
  const features = [
    {
      icon: <Users className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Client Workspaces',
      description: 'Keep every client, conversation, project, and document organized in its own dedicated workspace.',
    },
    {
      icon: <FolderKanban className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Projects & Milestones',
      description: 'Stay on top of deadlines, project budgets, milestones, and progress without losing track of important work.',
    },
    {
      icon: <CheckSquare className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Deliverable Versioning',
      description: 'Share work confidently with organized file versions, clear updates, and complete revision history.',
    },
    {
      icon: <GitFork className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Approvals & Revisions',
      description: 'Collect client feedback, manage revision requests, and get work approved without endless back-and-forth.',
    },
    {
      icon: <FileText className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Documents & File Requests',
      description: 'Keep essential documents, shared files, and client requests organized exactly where they belong.',
    },
    {
      icon: <Receipt className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Professional Invoicing',
      description: 'Create professional invoices with flexible taxes, discounts, currencies, and payment terms.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Client Portal',
      description: 'Give clients a dedicated space to review deliverables, share feedback, access documents, and track invoices.',
    },
    {
      icon: <Activity className="w-5 h-5 text-[#43D6B0]" />,
      title: 'Activity Timeline',
      description: 'See every important update, approval, comment, and payment event in one transparent activity history.',
    },
  ];

  return (
    <section id="features" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-3xl mx-auto mb-16 space-y-4"
      >
        <h2 className="text-3xl sm:text-5xl font-extrabold text-[#F5F5F0] tracking-tight leading-tight">
          Everything You Need to Run Your Freelance Business
        </h2>
        <p className="text-base sm:text-xl text-[#A6B4AE] max-w-2xl mx-auto leading-relaxed font-normal">
          One connected workspace for managing clients, delivering great work, and getting paid.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {features.map((feat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="group p-6 rounded-2xl bg-[#141816] border border-[#212B27] hover:border-[#43D6B0]/40 hover:bg-[#181E1B] transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#176B5B]/20 border border-[#176B5B]/40 text-[#43D6B0] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                {feat.icon}
              </div>
              <h3 className="text-lg font-bold text-[#F5F5F0] tracking-tight mb-2">{feat.title}</h3>
              <p className="text-sm text-[#A6B4AE] leading-relaxed font-normal">{feat.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
