import React from 'react';
import { TrendingUp, DollarSign, ArrowUpRight, Receipt, FileText } from 'lucide-react';

interface RevenueTrajectoryCardProps {
  totalRevenue: number;
  monthlyRevenue: number;
  pendingInvoicesAmount: number;
  revenueHistory: { month: string; amount: number }[];
  onNavigate: (view: string) => void;
}

export const RevenueTrajectoryCard: React.FC<RevenueTrajectoryCardProps> = ({
  totalRevenue,
  monthlyRevenue,
  pendingInvoicesAmount,
  revenueHistory,
  onNavigate,
}) => {
  const maxVal = Math.max(...revenueHistory.map((r) => r.amount), 35000);

  return (
    <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" /> Revenue &amp; Cashflow Trajectory
          </h3>
          <p className="text-xs text-zinc-400">6-month income velocity, settled invoices &amp; pending balance.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('invoices')}
            className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white text-white hover:text-zinc-950 border border-white/15 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Receipt className="w-3.5 h-3.5" /> Manage Invoices
          </button>
        </div>
      </div>

      {/* Top Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 rounded-xl bg-zinc-900/60 border border-white/10">
        <div>
          <p className="text-[11px] text-zinc-400 font-medium">Monthly Recurring Revenue</p>
          <p className="text-xl font-extrabold text-white tracking-tight my-0.5">${monthlyRevenue.toLocaleString()}</p>
          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
            <ArrowUpRight className="w-3 h-3" /> +18.4% growth
          </span>
        </div>

        <div>
          <p className="text-[11px] text-zinc-400 font-medium">Outstanding Balance</p>
          <p className="text-xl font-extrabold text-amber-400 tracking-tight my-0.5">${pendingInvoicesAmount.toLocaleString()}</p>
          <span className="text-[10px] text-zinc-400">Pending client clearance</span>
        </div>

        <div>
          <p className="text-[11px] text-zinc-400 font-medium">Total YTD Revenue</p>
          <p className="text-xl font-extrabold text-white tracking-tight my-0.5">${totalRevenue.toLocaleString()}</p>
          <span className="text-[10px] text-purple-400">Settled &amp; Deposited</span>
        </div>
      </div>

      {/* Trajectory Bar Chart */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs text-zinc-400 font-mono mb-2">
          <span>Monthly Income ($)</span>
          <span>Target: $30,000/mo</span>
        </div>

        <div className="h-44 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-white/10">
          {revenueHistory.map((item, idx) => {
            const heightPct = Math.round((item.amount / maxVal) * 100);
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group/bar relative h-full justify-end">
                {/* Tooltip on hover */}
                <div className="absolute -top-8 opacity-0 group-hover/bar:opacity-100 bg-zinc-900 border border-white/20 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow-lg transition-opacity pointer-events-none z-20">
                  ${item.amount.toLocaleString()}
                </div>

                {/* Bar */}
                <div
                  className="w-full max-w-[42px] bg-gradient-to-t from-emerald-600/80 to-emerald-400 group-hover/bar:from-emerald-500 group-hover/bar:to-emerald-300 rounded-t-lg transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* X-Axis Month Labels */}
        <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400 pt-2 px-2">
          {revenueHistory.map((item, idx) => (
            <span key={idx} className="flex-1 text-center truncate">
              {item.month}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
