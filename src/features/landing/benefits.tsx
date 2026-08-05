import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { XCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export const BenefitsSection: React.FC = () => {
  const replacements = [
    { oldTool: 'WhatsApp & iMessage', replacedBy: 'Client Portal Comments & Async Threads' },
    { oldTool: 'Fragmented Email Chains', replacedBy: 'Structured Workspace Timeline & Approvals' },
    { oldTool: 'Scattered Google Drive Folders', replacedBy: 'Centralized Versioned Document Repository' },
    { oldTool: 'Complex Excel Spreadsheets', replacedBy: 'Real-time Financial & Invoice Dashboard' },
    { oldTool: 'Manual Invoice Follow-ups', replacedBy: 'Automated Status Tracking & Due Reminders' },
    { oldTool: 'Lost Deliverable Files', replacedBy: 'Formal Approval Cards & Token Archives' },
  ];

  return (
    <section id="benefits" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto">
      <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">Consolidation</span>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Replace 6 chaotic tools with 1 quiet Operating System.
        </h2>
        <p className="text-sm text-zinc-400">
          Reclaim hours wasted searching through chat histories and chasing unapproved deliverables.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {replacements.map((item, idx) => (
          <div
            key={idx}
            className="p-6 rounded-2xl bg-zinc-900/60 border border-white/10 backdrop-blur-xl flex flex-col justify-between gap-4 hover:border-white/20 transition-colors"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 line-through">
                <XCircle className="w-4 h-4 text-zinc-500 shrink-0" />
                <span>{item.oldTool}</span>
              </div>
              <div className="flex items-start gap-2 text-sm font-bold text-white">
                <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
                <span>{item.replacedBy}</span>
              </div>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              FlowDesk Native
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};
