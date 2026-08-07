import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Users, FolderKanban, FileText, CheckSquare, Receipt, Globe, Activity } from 'lucide-react';

export const FeatureShowcase: React.FC = () => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const features = [
    {
      icon: <Users className="w-5 h-5 text-white" />,
      title: 'Client Workspaces',
      description: 'Dedicated isolated hubs for every client account with total billing history, contact notes, and status health.',
    },
    {
      icon: <FolderKanban className="w-5 h-5 text-white" />,
      title: 'Project Engineering',
      description: 'Granular budget tracking, milestone deadlines, completion progress, and tag taxonomy.',
    },
    {
      icon: <FileText className="w-5 h-5 text-white" />,
      title: 'Document Repository',
      description: 'Contracts, proposals, statements of work, and NDAs versioned cleanly in one place.',
    },
    {
      icon: <CheckSquare className="w-5 h-5 text-white" />,
      title: 'Deliverables & Approvals',
      description: 'Eliminate infinite revision emails with formal client approval cards and version tags.',
    },
    {
      icon: <Receipt className="w-5 h-5 text-white" />,
      title: 'Instant Invoicing',
      description: 'Create, send, and track status for paid, pending, draft, and overdue payments automatically.',
    },
    {
      icon: <Globe className="w-5 h-5 text-white" />,
      title: 'Client Magic Portals',
      description: 'Share zero-friction view-only portal links where clients review work without account log-ins.',
    },
    {
      icon: <Activity className="w-5 h-5 text-white" />,
      title: 'Real-time Activity Audit',
      description: 'A complete chronological timeline tracking client views, file uploads, comments, and payment events.',
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
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">Core Architecture</span>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Everything your freelance business requires. Nothing more.
        </h2>
        <p className="text-sm text-zinc-400">
          Built with timeless monochrome aesthetics and crystal glass tactile polish.
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
