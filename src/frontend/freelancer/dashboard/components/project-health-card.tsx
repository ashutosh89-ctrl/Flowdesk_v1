import React from 'react';
import { FolderKanban, AlertTriangle, CheckCircle2, ChevronRight, Clock, ShieldAlert } from 'lucide-react';
import { ProjectHealthSummary } from '@/shared/types';

interface ProjectHealthCardProps {
  summaries: ProjectHealthSummary[];
  onNavigate: (view: string) => void;
}

export const ProjectHealthCard: React.FC<ProjectHealthCardProps> = ({ summaries, onNavigate }) => {
  const getStatusBadge = (status: ProjectHealthSummary['status']) => {
    switch (status) {
      case 'Excellent':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/50">Excellent</span>;
      case 'Healthy':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#176B5B]/20 text-[#43D6B0] border border-[#176B5B]/40">Healthy</span>;
      case 'Needs Attention':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">Needs Attention</span>;
      case 'Critical':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/15 text-rose-300 border border-rose-500/30">At Risk</span>;
    }
  };

  return (
    <div className="bg-[#191F1D] border border-[#176B5B]/30 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-[#F5F5F0] tracking-tight flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-[#43D6B0]" /> Project Health &amp; Risk Radar
          </h3>
          <p className="text-xs text-[#A6B4AE]">Milestone execution, budget status &amp; client revision feedback.</p>
        </div>
        <button
          onClick={() => onNavigate('projects')}
          className="text-xs font-semibold text-[#43D6B0] hover:text-[#43D6B0]/80 flex items-center gap-1 transition-colors"
        >
          View All Projects <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {summaries.length === 0 ? (
        <div className="p-8 rounded-xl bg-[#101312]/40 border border-dashed border-[#176B5B]/30 text-center flex flex-col items-center justify-center">
          <FolderKanban className="w-8 h-8 text-[#A6B4AE]/50 mb-2" />
          <p className="text-sm font-medium text-[#F5F5F0]">No active projects yet</p>
          <p className="text-xs text-[#A6B4AE] mt-1 max-w-sm">
            Create your first project or milestone to monitor execution health and risk triggers in real-time.
          </p>
          <button
            onClick={() => onNavigate('projects')}
            className="mt-4 px-3 py-1.5 text-xs font-semibold bg-[#176B5B]/20 hover:bg-[#43D6B0] text-[#F5F5F0] hover:text-[#101312] border border-[#176B5B]/40 rounded-lg transition-colors"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summaries.map((item) => (
            <div
              key={item.projectId}
              onClick={() => onNavigate('projects')}
              className="p-4 rounded-xl bg-[#101312]/60 border border-[#176B5B]/30 hover:border-[#43D6B0]/50 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="text-sm font-bold text-[#F5F5F0] group-hover:text-[#43D6B0] transition-colors">
                      {item.projectTitle}
                    </h4>
                    <p className="text-xs text-[#A6B4AE]">{item.clientName}</p>
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                {/* Completion Progress Bar */}
                <div className="my-3 space-y-1">
                  <div className="flex justify-between text-[11px] text-[#A6B4AE] font-mono">
                    <span>Milestone Completion</span>
                    <span className="font-bold text-[#F5F5F0]">{item.completionPercentage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#176B5B]/25 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        item.completionPercentage === 100
                          ? 'bg-[#43D6B0]'
                          : item.status === 'Critical'
                          ? 'bg-rose-500'
                          : 'bg-[#43D6B0]'
                      }`}
                      style={{ width: `${item.completionPercentage}%` }}
                    />
                  </div>
                </div>

                {/* Reasons / Risk Triggers */}
                <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#A6B4AE] mt-3 pt-3 border-t border-[#176B5B]/20">
                  {item.reasons.map((reason, idx) => (
                    <span key={idx} className="flex items-center gap-1 bg-[#176B5B]/15 px-2 py-0.5 rounded text-[#F5F5F0] border border-[#176B5B]/30">
                      {item.status === 'Critical' || item.status === 'Needs Attention' ? (
                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3 text-[#43D6B0] shrink-0" />
                      )}
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
