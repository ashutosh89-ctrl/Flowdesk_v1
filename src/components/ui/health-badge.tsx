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

  if (normLevel === 'excellent') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[10px] font-mono font-semibold tracking-wide ${className}`}
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Excellent</span>
        {showScore && score !== undefined && <span className="opacity-75">({score})</span>}
      </span>
    );
  }

  if (normLevel === 'healthy') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-semibold tracking-wide ${className}`}
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Healthy</span>
        {showScore && score !== undefined && <span className="opacity-75">({score})</span>}
      </span>
    );
  }

  if (normLevel === 'attention') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[10px] font-mono font-semibold tracking-wide ${className}`}
      >
        <HeartPulse className="w-3.5 h-3.5 text-amber-400" />
        <span>Needs Attention</span>
        {showScore && score !== undefined && <span className="opacity-75">({score})</span>}
      </span>
    );
  }

  if (normLevel === 'critical' || normLevel === 'risk') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/25 text-[10px] font-mono font-semibold tracking-wide ${className}`}
      >
        <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
        <span>Critical</span>
        {showScore && score !== undefined && <span className="opacity-75">({score})</span>}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-white/10 text-[10px] font-mono font-semibold ${className}`}
    >
      <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
      <span className="capitalize">{level}</span>
    </span>
  );
};
