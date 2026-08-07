import React from 'react';
import {
  Users,
  FolderKanban,
  FileCheck,
  Receipt,
  TrendingUp,
  DollarSign,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  FileSearch,
} from 'lucide-react';
import { BusinessMetrics } from '../../../types';

interface BusinessSnapshotProps {
  metrics: BusinessMetrics;
  onNavigate: (view: string) => void;
}

export const BusinessSnapshot: React.FC<BusinessSnapshotProps> = ({ metrics, onNavigate }) => {
  const cards = [
    {
      id: 'active_clients',
      label: 'Active Clients',
      value: metrics.activeClientsCount.toString(),
      subtext: '3 enterprise tier',
      icon: <Users className="w-5 h-5 text-indigo-400" />,
      color: 'from-indigo-500/10 to-transparent',
      borderColor: 'border-indigo-500/20',
      actionView: 'clients',
    },
    {
      id: 'active_projects',
      label: 'Active Projects',
      value: metrics.activeProjectsCount.toString(),
      subtext: `${metrics.completionRate}% avg completion`,
      icon: <FolderKanban className="w-5 h-5 text-sky-400" />,
      color: 'from-sky-500/10 to-transparent',
      borderColor: 'border-sky-500/20',
      actionView: 'projects',
    },
    {
      id: 'pending_deliverables',
      label: 'Pending Deliverables',
      value: metrics.pendingDeliverablesCount.toString(),
      subtext: 'Packages in review',
      icon: <FileCheck className="w-5 h-5 text-emerald-400" />,
      color: 'from-emerald-500/10 to-transparent',
      borderColor: 'border-emerald-500/20',
      actionView: 'deliverables',
    },
    {
      id: 'pending_invoices',
      label: 'Pending Invoices',
      value: `$${metrics.pendingInvoicesAmount.toLocaleString()}`,
      subtext: `${metrics.pendingInvoicesCount} invoices pending`,
      icon: <Receipt className="w-5 h-5 text-amber-400" />,
      color: 'from-amber-500/10 to-transparent',
      borderColor: 'border-amber-500/20',
      actionView: 'invoices',
    },
    {
      id: 'monthly_revenue',
      label: 'Monthly Revenue',
      value: `$${metrics.monthlyRevenue.toLocaleString()}`,
      subtext: `+${metrics.revenueGrowthPct}% vs last month`,
      icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
      color: 'from-emerald-500/10 to-transparent',
      borderColor: 'border-emerald-500/20',
      actionView: 'invoices',
    },
    {
      id: 'total_revenue',
      label: 'Total Revenue (YTD)',
      value: `$${metrics.totalRevenue.toLocaleString()}`,
      subtext: 'Settled & cleared',
      icon: <DollarSign className="w-5 h-5 text-amber-400" />,
      color: 'from-amber-500/10 to-transparent',
      borderColor: 'border-amber-500/20',
      actionView: 'invoices',
    },
    {
      id: 'missing_docs',
      label: 'Missing Documents',
      value: metrics.pendingDocumentsCount.toString(),
      subtext: 'Client onboarding items',
      icon: <FileSearch className="w-5 h-5 text-rose-400" />,
      color: 'from-rose-500/10 to-transparent',
      borderColor: 'border-rose-500/20',
      actionView: 'documents',
    },
    {
      id: 'health_score',
      label: 'Workspace Health',
      value: `${metrics.workspaceHealthScore}/100`,
      subtext: 'Optimal operational score',
      icon: <ShieldCheck className="w-5 h-5 text-purple-400" />,
      color: 'from-purple-500/10 to-transparent',
      borderColor: 'border-purple-500/20',
      actionView: 'dashboard',
    },
  ];

  return (
    <div className="bg-zinc-950/80 border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" /> Business Intelligence Snapshot
          </h2>
          <p className="text-xs text-zinc-400">High-level financial &amp; operational metrics across all client hubs.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.id}
            onClick={() => onNavigate(card.actionView)}
            className={`p-4 rounded-xl bg-gradient-to-br ${card.color} bg-zinc-900/60 border ${card.borderColor} hover:border-white/30 transition-all cursor-pointer group flex flex-col justify-between`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:scale-105 transition-transform">
                {card.icon}
              </span>
              <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
            </div>

            <div>
              <p className="text-xs font-medium text-zinc-400">{card.label}</p>
              <h3 className="text-xl font-extrabold text-white tracking-tight my-0.5 group-hover:text-amber-300 transition-colors">
                {card.value}
              </h3>
              <p className="text-[11px] text-zinc-400">{card.subtext}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
