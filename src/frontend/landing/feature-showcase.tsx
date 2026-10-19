import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Users, FolderKanban, FileText, CheckSquare, Receipt, ShieldCheck, Activity, GitFork } from 'lucide-react';

export const FeatureShowcase: React.FC = () => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const features = [
    {
      icon: <Users className="w-5 h-5 text-white" />,
      title: 'Client Workspaces',
      description: 'Keep every client, conversation, project, and document organized in its own dedicated workspace.',
    },
    {
      icon: <FolderKanban className="w-5 h-5 text-white" />,
      title: 'Projects & Milestones',
      description: 'Stay on top of deadlines, project budgets, milestones, and progress without losing track of important work.',
    },
    {
      icon: <CheckSquare className="w-5 h-5 text-white" />,
      title: 'Deliverable Versioning',
      description: 'Share work confidently with organized file versions, clear updates, and complete revision history.',
    },
    {
      icon: <GitFork className="w-5 h-5 text-white" />,
      title: 'Approvals & Revisions',
      description: 'Collect client feedback, manage revision requests, and get work approved without endless back-and-forth.',
    },
    {
      icon: <FileText className="w-5 h-5 text-white" />,
      title: 'Documents & File Requests',
      description: 'Keep essential documents, shared files, and client requests organized exactly where they belong.',
    },
    {
      icon: <Receipt className="w-5 h-5 text-white" />,
      title: 'Professional Invoicing',
      description: 'Create professional invoices with flexible taxes, discounts, currencies, and payment terms.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-white" />,
      title: 'Client Portal',
      description: 'Give clients a dedicated space to review deliverables, share feedback, access documents, and track invoices.',
    },
    {
      icon: <Activity className="w-5 h-5 text-white" />,
      title: 'Activity Timeline',
      description: 'See every important update, approval, comment, and payment event in one transparent activity history.',
    },
  ];

  return (
    <section id="features" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-3xl mx-auto mb-16 space-y-4"
      >
        <span className="text-xs sm:text-[13px] font-mono uppercase tracking-widest text-[#E8F0FF] bg-[#0047AB]/20 px-4 py-1.5 rounded-full border border-[#2563EB]/30 font-semibold">
          Complete Workspace Features
        </span>
        <h2 className="text-4xl sm:text-5xl lg:text-[50px] font-extrabold text-white tracking-tight leading-tight">
          Everything You Need to Run Your Freelance Business
        </h2>
        <p className="text-lg sm:text-xl lg:text-[22px] text-zinc-300 max-w-3xl mx-auto leading-relaxed font-normal">
          One connected workspace for managing clients, delivering great work, collecting approvals, and getting paid on time.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 24, filter: 'blur(4px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: false, amount: 0.15 }}
            transition={{ duration: 0.5, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            className="relative"
          >
            <Card interactive className="group h-full relative overflow-hidden transition-all duration-300 hover:border-[#2563EB]/40 p-6 sm:p-7">
              {hoveredIdx === idx && (
                <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                  style={{
                    background: `radial-gradient(circle 220px at ${mousePos.x}px ${mousePos.y}px, rgba(37, 99, 235, 0.12), transparent 70%)`,
                  }}
                />
              )}
              <CardHeader className="mb-3">
                <div className="w-12 h-12 rounded-xl bg-[#0047AB]/10 border border-[#2563EB]/25 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-[#0047AB] group-hover:text-white transition-all duration-300">
                  {feat.icon}
                </div>
                <CardTitle className="text-2xl font-bold text-white tracking-tight">{feat.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base sm:text-lg text-zinc-300 leading-relaxed font-normal">{feat.description}</CardDescription>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
