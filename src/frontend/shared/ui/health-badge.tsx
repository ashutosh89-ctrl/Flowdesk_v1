import React from 'react';
import { ShieldCheck, HeartPulse, AlertTriangle, AlertOctagon } from 'lucide-react';

export type HealthScoreLevel = 'excellent' | 'healthy' | 'attention' | 'critical' | 'risk';

export interface HealthBadgeProps {
  level?: HealthScoreLevel | string;
  score?: number;
  showScore?: boolean;
  className?: string;
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({
  level = 'healthy',
  score,
  showScore = false,
  className = '',
}) => {
  const normLevel = (level || 'healthy').toLowerCase();
  const baseClasses = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors";

  if (normLevel === 'excellent' || normLevel === 'healthy') {
    return (
      <span className={`${baseClasses} bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ${className}`}>
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>Healthy</span>
        {showScore && score !== undefined && <span className="opacity-75">({score})</span>}
      </span>
    );
  }

  if (normLevel === 'attention') {
    return (
      <span className={`${baseClasses} bg-amber-500/10 text-amber-400 border-amber-500/20 ${className}`}>
        <HeartPulse className="w-3.5 h-3.5 shrink-0" />
        <span>Attention</span>
        {showScore && score !== undefined && <span className="opacity-75">({score})</span>}
      </span>
    );
  }

  if (normLevel === 'critical' || normLevel === 'risk') {
    return (
      <span className={`${baseClasses} bg-rose-500/10 text-rose-400 border-rose-500/20 ${className}`}>
        <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
        <span>Critical</span>
        {showScore && score !== undefined && <span className="opacity-75">({score})</span>}
      </span>
    );
  }

  return (
    <span className={`${baseClasses} bg-zinc-800 text-zinc-300 border-white/10 ${className}`}>
      <ShieldCheck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
      <span className="capitalize">{level}</span>
    </span>
  );
};
