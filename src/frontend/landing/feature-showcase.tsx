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
      description: 'Keep every client relationship organized with a dedicated workspace for contact details, projects, deliverables, invoices, and ongoing work.',
    },
    {
      icon: <FolderKanban className="w-5 h-5 text-white" />,
      title: 'Projects & Milestones',
      description: 'Plan project timelines, track progress, manage budgets, and keep important work moving toward completion.',
    },
    {
      icon: <CheckSquare className="w-5 h-5 text-white" />,
      title: 'Deliverable Versioning',
      description: 'Keep deliverable files and versions organized so you and your client always know what is current and ready for review.',
    },
    {
      icon: <GitFork className="w-5 h-5 text-white" />,
      title: 'Approvals & Revisions',
      description: 'Turn client feedback into clear approval and revision requests linked directly to the work being reviewed.',
    },
    {
      icon: <FileText className="w-5 h-5 text-white" />,
      title: 'Documents & File Requests',
      description: 'Keep project documents and requested files organized in the right client workspace instead of searching through scattered folders.',
    },
    {
      icon: <Receipt className="w-5 h-5 text-white" />,
      title: 'Professional Invoicing',
      description: 'Create itemized invoices with configurable taxes, discounts, currencies, payment terms, and professional PDF output.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-white" />,
      title: 'Client Portal',
      description: 'Give clients one place to review work, respond to deliverables, request revisions, access documents, and view their invoices.',
    },
    {
      icon: <Activity className="w-5 h-5 text-white" />,
      title: 'Activity Timeline',
      description: 'Keep a clear history of important project activity, including deliverable updates, approvals, comments, and payment events.',
    },
  ];

  return (
    <section id="features" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-2xl mx-auto mb-16 space-y-4"
      >
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">Features</span>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Everything your freelance business requires.
        </h2>
        <p className="text-sm text-zinc-400">
          Purpose-built tools to manage client work with clarity and confidence.
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
            <Card interactive className="group h-full relative overflow-hidden transition-all duration-300 hover:border-white/30">
              {hoveredIdx === idx && (
                <div
                  className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                  style={{
                    background: `radial-gradient(circle 220px at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.08), transparent 70%)`,
                  }}
                />
              )}
              <CardHeader>
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-white group-hover:text-zinc-950 transition-all duration-300">
                  {feat.icon}
                </div>
                <CardTitle>{feat.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feat.description}</CardDescription>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
