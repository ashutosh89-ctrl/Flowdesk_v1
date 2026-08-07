import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  FileText,
  AlertCircle,
  FileSearch,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Check,
} from 'lucide-react';
import { TodayFocusItem, TodayFocusPriority } from '../../../types';

interface TodayFocusCardProps {
  items: TodayFocusItem[];
  onAction: (item: TodayFocusItem) => void;
  onNavigate: (view: string) => void;
}

export const TodayFocusCard: React.FC<TodayFocusCardProps> = ({ items, onAction, onNavigate }) => {
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState<'all' | TodayFocusPriority>('all');

  const handleToggleComplete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (completedIds.includes(id)) {
      setCompletedIds(completedIds.filter((item) => item !== id));
    } else {
      setCompletedIds([...completedIds, id]);
    }
  };

  const activeItems = items.filter((item) => !completedIds.includes(item.id));
  const filteredItems = activeItems.filter(
    (item) => filterPriority === 'all' || item.priority === filterPriority
  );

  const getPriorityBadge = (priority: TodayFocusPriority) => {
    switch (priority) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" /> Critical
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-3 h-3" /> High Priority
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Clock className="w-3 h-3" /> Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
            Normal
          </span>
        );
    }
  };

  const getCategoryIcon = (category: TodayFocusItem['category']) => {
    switch (category) {
      case 'overdue_invoice':
        return <FileText className="w-4 h-4 text-rose-400" />;
      case 'revision_requested':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'missing_file':
        return <FileSearch className="w-4 h-4 text-sky-400" />;
      case 'approval_waiting':
        return <Clock className="w-4 h-4 text-emerald-400" />;
      case 'comment_unanswered':
        return <MessageSquare className="w-4 h-4 text-purple-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
      {/* Top Ambient Glow */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Today&apos;s Focus & Decision Engine</h2>
          </div>
          <p className="text-xs text-zinc-400">
            {activeItems.length === 0
              ? 'All critical decisions resolved! FlowDesk is on schedule.'
              : `${activeItems.length} action item${activeItems.length === 1 ? '' : 's'} requiring attention today.`}
          </p>
        </div>

        {/* Priority Filter Chips */}
        <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 border border-white/10 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setFilterPriority('all')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
              filterPriority === 'all'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All ({activeItems.length})
          </button>
          <button
            onClick={() => setFilterPriority('critical')}
            className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-all ${
              filterPriority === 'critical'
                ? 'bg-rose-500 text-white font-semibold'
                : 'text-rose-400 hover:bg-rose-500/10'
            }`}
          >
            Critical ({activeItems.filter((i) => i.priority === 'critical').length})
          </button>
          <button
            onClick={() => setFilterPriority('high')}
            className={`px-2 py-1 text-[11px] font-medium rounded-lg transition-all ${
              filterPriority === 'high'
                ? 'bg-amber-500 text-white font-semibold'
                : 'text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            High ({activeItems.filter((i) => i.priority === 'high').length})
          </button>
        </div>
      </div>

      {/* Item List */}
      <div className="space-y-3 relative z-10">
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center bg-zinc-900/40 border border-dashed border-white/10 rounded-xl p-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-80" />
            <h3 className="text-sm font-semibold text-white">No Action Items Pending</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              {filterPriority === 'all'
                ? 'Great job! You have cleared all overdue invoices, pending approvals, and requested revisions.'
                : `No items matched the ${filterPriority} priority filter.`}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => onAction(item)}
              className="p-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-white/10 hover:border-white/20 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group/item shadow-sm hover:shadow-md"
            >
              <div className="flex items-start gap-3 min-w-0">
                <button
                  onClick={(e) => handleToggleComplete(item.id, e)}
                  title="Mark as done"
                  className="mt-0.5 p-1 rounded-md border border-zinc-700 bg-zinc-800 text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>

                <div className="p-2 rounded-xl bg-zinc-800/80 border border-white/10 shrink-0">
                  {getCategoryIcon(item.category)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="text-xs font-bold text-white group-hover/item:text-amber-300 transition-colors truncate">
                      {item.title}
                    </h4>
                    {getPriorityBadge(item.priority)}
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-1">{item.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction(item);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white text-white hover:text-zinc-950 border border-white/15 rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <span>{item.actionText}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Completed Footer Notice */}
      {completedIds.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-zinc-500">
          <span>{completedIds.length} item(s) resolved in this session.</span>
          <button
            onClick={() => setCompletedIds([])}
            className="text-amber-400 hover:underline text-[11px]"
          >
            Reset resolved
          </button>
        </div>
      )}
    </div>
  );
};
