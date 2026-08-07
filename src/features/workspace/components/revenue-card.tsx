import React from 'react';
import { Card } from '../../../components/ui/card';
import { DollarSign, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';

export interface RevenueCardProps {
  totalBilled: number;
  outstandingBalance?: number;
  currency?: string;
}

export const RevenueCard: React.FC<RevenueCardProps> = ({
  totalBilled,
  outstandingBalance = 0,
  currency = 'USD',
}) => {
  return (
    <Card variant="crystal" className="p-5 border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase text-zinc-400 font-semibold flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          Revenue Summary
        </span>
        <span className="text-[10px] font-mono text-zinc-500">{currency}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-0.5">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">Lifetime Revenue</span>
          <span className="text-lg font-bold text-white font-mono">
            ${totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/[0.03] border border-amber-500/20 space-y-0.5">
          <span className="text-[10px] font-mono text-amber-400/80 uppercase block">Pending Outstanding</span>
          <span className="text-lg font-bold text-amber-400 font-mono">
            ${outstandingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </Card>
  );
};
