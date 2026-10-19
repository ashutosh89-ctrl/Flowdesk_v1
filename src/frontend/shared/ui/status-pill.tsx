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
      case 'completed':
      case 'approved':
      case 'paid':
      case 'signed':
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
          container: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
        };
      case 'active':
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-[#2563EB] shadow-[0_0_8px_rgba(37,99,235,0.8)]',
          container: 'bg-[#0047AB]/15 text-[#E8F0FF] border-[#2563EB]/40',
        };
      case 'in_progress':
      case 'in_review':
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-[#2563EB]',
          container: 'bg-[#0047AB]/15 text-[#E8F0FF] border-[#2563EB]/35',
        };
      case 'pending':
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-amber-400',
          container: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
        };
      case 'overdue':
        return {
          label: customLabel || 'Overdue',
          dot: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
          container: 'bg-rose-950/40 text-rose-300 border-rose-500/35',
        };
      case 'draft':
      case 'todo':
      case 'inactive':
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-zinc-500',
          container: 'bg-[#181818] text-zinc-400 border-[#2A2A2A]',
        };
      case 'pending_deletion':
        return {
          label: customLabel || 'Pending Deletion',
          dot: 'bg-rose-400 animate-pulse',
          container: 'bg-rose-950/40 text-rose-300 border-rose-500/30',
        };
      default:
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-zinc-400',
          container: 'bg-[#181818] text-zinc-300 border-[#2A2A2A]',
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
