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
          dot: 'bg-[#43D6B0]',
          container: 'bg-[#176B5B]/20 text-[#43D6B0] border-[#176B5B]/40',
        };
      case 'active':
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-[#43D6B0]',
          container: 'bg-[#176B5B]/20 text-[#43D6B0] border-[#176B5B]/50',
        };
      case 'in_progress':
      case 'in_review':
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-[#43D6B0]',
          container: 'bg-[#176B5B]/20 text-[#43D6B0] border-[#176B5B]/40',
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
          dot: 'bg-rose-400',
          container: 'bg-rose-950/40 text-rose-300 border-rose-500/35',
        };
      case 'draft':
      case 'todo':
      case 'inactive':
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-[#A6B4AE]/60',
          container: 'bg-[#191F1D] text-[#A6B4AE] border-[#176B5B]/30',
        };
      case 'pending_deletion':
        return {
          label: customLabel || 'Pending Deletion',
          dot: 'bg-rose-400',
          container: 'bg-rose-950/40 text-rose-300 border-rose-500/30',
        };
      default:
        return {
          label: customLabel || st.replace('_', ' '),
          dot: 'bg-[#A6B4AE]',
          container: 'bg-[#191F1D] text-[#A6B4AE] border-[#176B5B]/30',
        };
    }
  };

  const config = getStatusConfig(normalized);

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold border backdrop-blur-md uppercase tracking-wider ${config.container} ${className}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${config.dot}`} />
      <span className="capitalize">{config.label}</span>
    </span>
  );
};
