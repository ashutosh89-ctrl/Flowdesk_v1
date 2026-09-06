import React from 'react';
import { ApprovalStatus } from '@/shared/types';
import {
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';

interface ApprovalBadgeProps {
  status?: ApprovalStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const ApprovalBadge: React.FC<ApprovalBadgeProps> = ({
  status = 'pending',
  size = 'md',
  showIcon = true,
}) => {
  const normalized = (status || 'pending').toLowerCase();

  let label = 'Pending';
  let colorClasses = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  let icon = <Clock className="w-3 h-3" />;

  switch (normalized) {
    case 'pending':
      label = 'Pending Review';
      colorClasses = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      icon = <Clock className="w-3 h-3" />;
      break;
    case 'viewed':
      label = 'Viewed by Client';
      colorClasses = 'bg-blue-500/10 text-blue-300 border-blue-500/20';
      icon = <Eye className="w-3 h-3" />;
      break;
    case 'approved':
      label = 'Approved';
      colorClasses = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      icon = <CheckCircle2 className="w-3 h-3" />;
      break;
    case 'rejected':
      label = 'Rejected';
      colorClasses = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
      icon = <XCircle className="w-3 h-3" />;
      break;
    case 'revision_requested':
    case 'changes_requested':
      label = 'Revision Requested';
      colorClasses = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      icon = <AlertTriangle className="w-3 h-3" />;
      break;
    case 'expired':
      label = 'Review Expired';
      colorClasses = 'bg-zinc-800 text-zinc-400 border-zinc-700';
      icon = <AlertCircle className="w-3 h-3" />;
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
