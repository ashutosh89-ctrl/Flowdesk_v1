import React from 'react';
import { DeliverableStatus } from '@/shared/types';
import {
  FileEdit,
  Clock,
  Send,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Sparkles,
  CheckCheck,
} from 'lucide-react';

interface StatusBadgeProps {
  status: DeliverableStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  const normalized = (status || 'draft').toLowerCase();

  let label = 'Draft';
  let colorClasses = 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60';
  let icon = <FileEdit className="w-3 h-3" />;

  switch (normalized) {
    case 'draft':
      label = 'Draft';
      colorClasses = 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60';
      icon = <FileEdit className="w-3 h-3" />;
      break;
    case 'preparing':
      label = 'Preparing';
      colorClasses = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';
      icon = <Clock className="w-3 h-3" />;
      break;
    case 'ready_for_review':
    case 'ready':
      label = 'Ready for Review';
      colorClasses = 'bg-blue-500/10 text-blue-300 border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]';
      icon = <Sparkles className="w-3 h-3" />;
      break;
    case 'submitted':
    case 'in_review':
      label = 'Submitted';
      colorClasses = 'bg-purple-500/10 text-purple-300 border-purple-500/20';
      icon = <Send className="w-3 h-3" />;
      break;
    case 'approved':
      label = 'Approved';
      colorClasses = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]';
      icon = <CheckCircle2 className="w-3 h-3" />;
      break;
    case 'revision_requested':
    case 'changes_requested':
      label = 'Revision Requested';
      colorClasses = 'bg-amber-500/10 text-amber-300 border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]';
      icon = <AlertTriangle className="w-3 h-3" />;
      break;
    case 'completed':
      label = 'Completed';
      colorClasses = 'bg-teal-500/10 text-teal-300 border-teal-500/20';
      icon = <CheckCheck className="w-3 h-3" />;
      break;
    case 'archived':
      label = 'Archived';
      colorClasses = 'bg-zinc-900 text-zinc-500 border-zinc-800';
      icon = <Archive className="w-3 h-3" />;
      break;
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-xs font-semibold gap-1.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-lg border font-medium transition-all ${colorClasses} ${sizeClasses}`}
    >
      {showIcon && icon}
      <span>{label}</span>
    </span>
  );
};
