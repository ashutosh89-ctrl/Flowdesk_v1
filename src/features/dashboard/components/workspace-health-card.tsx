import React from 'react';
import { ShieldCheck, AlertCircle, AlertTriangle, ArrowRight, CheckCircle } from 'lucide-react';
import { WorkspaceHealth } from '../../../types';

interface WorkspaceHealthCardProps {
  health: WorkspaceHealth;
  onNavigate: (view: string) => void;
  onAction?: (actionType: string) => void;
}

export const WorkspaceHealthCard: React.FC<WorkspaceHealthCardProps> = ({ health, onNavigate, onAction }) => {
  const getStatusBadge = (status: WorkspaceHealth['status']) => {
    switch (status) {
      case 'Excellent':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Excellent Health
          </span>
        );
      case 'Healthy':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Healthy
          </span>
        );
      case 'Needs Attention':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Needs Attention
          </span>
        );
      case 'Critical':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Action Required
          </span>
        );
    }
  };

  return (
    <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Workspace Health Score</h3>
              <p className="text-xs text-zinc-400">Real-time risk assessment &amp; recommendations.</p>
            </div>
          </div>
          {getStatusBadge(health.status)}
        </div>

        {/* Score Radial Visualizer */}
        <div className="flex items-center gap-6 p-4 rounded-xl bg-zinc-900/60 border border-white/10 mb-6">
          <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-zinc-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={health.score >= 80 ? 'text-emerald-400' : health.score >= 60 ? 'text-amber-400' : 'text-rose-400'}
                strokeDasharray={`${health.score}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xl font-black text-white">{health.score}</span>
          </div>

          <div className="space-y-1 text-xs min-w-0">
            <div className="flex items-center justify-between gap-4 text-zinc-300">
              <span>Overdue Invoices:</span>
              <span className={`font-bold ${health.metrics.overdueInvoicesCount > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
                {health.metrics.overdueInvoicesCount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-zinc-300">
              <span>Late Projects:</span>
              <span className={`font-bold ${health.metrics.lateProjectsCount > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
                {health.metrics.lateProjectsCount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-zinc-300">
              <span>Pending Approvals:</span>
              <span className="font-bold text-sky-400">{health.metrics.pendingApprovalsCount}</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-zinc-300">
              <span>Client Engagement:</span>
              <span className="font-bold text-emerald-400">{health.metrics.clientEngagementScore}%</span>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Smart Recommendations
          </h4>
          {health.recommendations.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">No recommendations at this time.</p>
          ) : (
            health.recommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-medium text-white">{rec.title}</p>
                  <p className="text-[11px] text-zinc-400 line-clamp-1">{rec.description}</p>
                </div>
                <button
                  onClick={() => {
                    if (rec.targetType === 'invoice') onNavigate('invoices');
                    else if (rec.targetType === 'deliverable') onNavigate('deliverables');
                    else if (rec.targetType === 'document') onNavigate('documents');
                    else if (onAction) onAction(rec.actionType);
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium bg-white/10 hover:bg-white text-white hover:text-zinc-950 rounded-lg transition-colors shrink-0 flex items-center gap-1"
                >
                  <span>{rec.actionText}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
