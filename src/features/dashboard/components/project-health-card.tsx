import React from 'react';
import { FolderKanban, AlertTriangle, CheckCircle2, ChevronRight, Clock, ShieldAlert } from 'lucide-react';
import { ProjectHealthSummary } from '../../../types';

interface ProjectHealthCardProps {
  summaries: ProjectHealthSummary[];
  onNavigate: (view: string) => void;
}

export const ProjectHealthCard: React.FC<ProjectHealthCardProps> = ({ summaries, onNavigate }) => {
  const getStatusBadge = (status: ProjectHealthSummary['status']) => {
    switch (status) {
      case 'Excellent':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Excellent</span>;
      case 'Healthy':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">Healthy</span>;
      case 'Needs Attention':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">Needs Attention</span>;
      case 'Critical':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">At Risk</span>;
    }
  };

  return (
    <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-sky-400" /> Project Health &amp; Risk Radar
          </h3>
          <p className="text-xs text-zinc-400">Milestone execution, budget status &amp; client revision feedback.</p>
        </div>
        <button
          onClick={() => onNavigate('projects')}
          className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
        >
          View All Projects <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summaries.map((item) => (
          <div
            key={item.projectId}
            onClick={() => onNavigate('projects')}
            className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 hover:border-white/25 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    {item.projectTitle}
                  </h4>
                  <p className="text-xs text-zinc-400">{item.clientName}</p>
                </div>
                {getStatusBadge(item.status)}
              </div>

              {/* Completion Progress Bar */}
              <div className="my-3 space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400 font-mono">
                  <span>Milestone Completion</span>
                  <span className="font-bold text-white">{item.completionPercentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      item.completionPercentage === 100
                        ? 'bg-emerald-400'
                        : item.status === 'Critical'
                        ? 'bg-rose-500'
                        : 'bg-sky-400'
                    }`}
                    style={{ width: `${item.completionPercentage}%` }}
                  />
                </div>
              </div>

              {/* Reasons / Risk Triggers */}
              <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-400 mt-3 pt-3 border-t border-white/5">
                {item.reasons.map((reason, idx) => (
                  <span key={idx} className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-zinc-300 border border-white/5">
                    {item.status === 'Critical' || item.status === 'Needs Attention' ? (
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    )}
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
