import React from 'react';

export type StatusPillType =
  | 'active'
  | 'pending'
  | 'completed'
  | 'approved'
  | 'in_progress'
  | 'in_review'
  | 'draft'
  | 'overdue'
  | 'paid'
  | 'todo'
  | 'signed'
  | 'inactive';

export interface StatusPillProps {
  status: StatusPillType | string;
  customLabel?: string;
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, customLabel, className = '' }) => {
  const normalized = status.toLowerCase().replace('-', '_');

  const getStatusConfig = (st: string) => {
    switch (st) {
      case 'active':
      case 'completed':
      case 'approved':
      case 'paid':
      case 'signed':
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]',
          container: 'bg-white/10 text-white border-white/20',
        };
      case 'in_progress':
      case 'in_review':
      case 'pending':
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-zinc-300',
          container: 'bg-zinc-800/80 text-zinc-200 border-zinc-700',
        };
      case 'draft':
      case 'todo':
      case 'inactive':
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-zinc-500',
          container: 'bg-zinc-900/90 text-zinc-400 border-zinc-800',
        };
      case 'overdue':
        return {
          label: customLabel || 'Overdue',
          dot: 'bg-zinc-100',
          container: 'bg-zinc-900 text-zinc-200 border-zinc-600',
        };
      default:
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-zinc-400',
          container: 'bg-zinc-800/60 text-zinc-300 border-zinc-700/60',
        };
    }
  };

  const config = getStatusConfig(normalized);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-md uppercase tracking-wider ${config.container} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span className="capitalize">{config.label}</span>
    </span>
  );
};
