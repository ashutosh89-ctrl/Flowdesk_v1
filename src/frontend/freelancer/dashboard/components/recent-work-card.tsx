import React from 'react';
import { Clock, FolderKanban, Users, FileText, Receipt, ArrowRight, Play } from 'lucide-react';
import { RecentItem } from '@/shared/types';

interface RecentWorkCardProps {
  items: RecentItem[];
  onNavigate: (view: string) => void;
}

export const RecentWorkCard: React.FC<RecentWorkCardProps> = ({ items, onNavigate }) => {
  const getTypeIcon = (type: RecentItem['type']) => {
    switch (type) {
      case 'project':
        return <FolderKanban className="w-4 h-4 text-sky-400" />;
      case 'client':
        return <Users className="w-4 h-4 text-indigo-400" />;
      case 'deliverable':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'invoice':
        return <Receipt className="w-4 h-4 text-amber-400" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Recent Work &amp; Quick Resume</h3>
              <p className="text-xs text-zinc-400">Continue exactly where you left off.</p>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-6 rounded-xl bg-zinc-900/40 border border-dashed border-white/10 text-center flex flex-col items-center justify-center">
            <Clock className="w-6 h-6 text-zinc-600 mb-2" />
            <p className="text-xs font-medium text-zinc-400">No recent activity recorded</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Your recent projects, deliverables, and invoices will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                onClick={() => onNavigate(item.path)}
                className="p-3 rounded-xl bg-zinc-900/60 border border-white/10 hover:border-white/20 transition-all cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10 shrink-0">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 truncate">{item.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-zinc-500">{item.timestamp}</span>
                  <button className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white text-zinc-400 group-hover:text-zinc-950 transition-colors">
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
