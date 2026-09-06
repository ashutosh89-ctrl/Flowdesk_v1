import React, { useState } from 'react';
import { Activity, Clock, User, Filter, ArrowRight } from 'lucide-react';
import { ActivityLog } from '@/shared/types';

interface GlobalActivityCardProps {
  activities: ActivityLog[];
  onNavigate: (view: string) => void;
}

export const GlobalActivityCard: React.FC<GlobalActivityCardProps> = ({ activities, onNavigate }) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'client' | 'project' | 'invoice' | 'deliverable' | 'document'>('all');

  const filtered = activities.filter((act) => categoryFilter === 'all' || act.category === categoryFilter);

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'client':
        return <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Client</span>;
      case 'project':
        return <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">Project</span>;
      case 'invoice':
        return <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Invoice</span>;
      case 'deliverable':
        return <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Deliverable</span>;
      case 'document':
        return <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">Document</span>;
      default:
        return <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">System</span>;
    }
  };

  return (
    <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl h-full flex flex-col justify-between">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Global Audit &amp; Activity Stream</h3>
              <p className="text-xs text-zinc-400">Real-time workspace activity across clients &amp; portal hubs.</p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('activity')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors self-start sm:self-auto"
          >
            Full Audit Trail <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {(['all', 'client', 'project', 'invoice', 'deliverable', 'document'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg capitalize whitespace-nowrap transition-colors ${
                categoryFilter === cat
                  ? 'bg-white text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-white bg-zinc-900/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Activity Feed Items */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-6 text-center">No activity records match the selected category.</p>
          ) : (
            filtered.slice(0, 8).map((act) => (
              <div
                key={act.id}
                className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 hover:border-white/10 transition-all flex items-start justify-between gap-3 text-xs"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0 font-bold text-[10px] text-zinc-300">
                    {act.user.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-bold text-white">{act.user}</span>
                      <span className="text-zinc-400">{act.action}</span>
                      <span className="font-semibold text-amber-300 truncate max-w-[140px]">{act.target}</span>
                      {getCategoryBadge(act.category)}
                    </div>
                    {act.metadata && <p className="text-[11px] text-zinc-400 truncate">{act.metadata}</p>}
                  </div>
                </div>

                <span className="text-[10px] font-mono text-zinc-500 shrink-0">{act.timestamp}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
