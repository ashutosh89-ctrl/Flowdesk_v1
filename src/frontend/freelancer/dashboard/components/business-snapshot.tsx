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
import { BusinessMetrics } from '@/shared/types';
import { useAuth } from '@/frontend/auth/auth-context';
import { formatCurrency } from '@/shared/utils/currency';

interface BusinessSnapshotProps {
  metrics: BusinessMetrics;
  onNavigate: (view: string) => void;
  currency?: string;
}

export const BusinessSnapshot: React.FC<BusinessSnapshotProps> = ({ metrics, onNavigate, currency: propCurrency }) => {
  const { profile, userSettings } = useAuth();
  const currency = propCurrency || userSettings?.currency || profile?.currency || 'USD';
  const safeMetrics = {
    activeClientsCount: metrics?.activeClientsCount ?? 0,
    activeProjectsCount: metrics?.activeProjectsCount ?? 0,
    pendingDeliverablesCount: metrics?.pendingDeliverablesCount ?? 0,
    pendingInvoicesAmount: metrics?.pendingInvoicesAmount ?? 0,
    pendingInvoicesCount: metrics?.pendingInvoicesCount ?? 0,
    monthlyRevenue: metrics?.monthlyRevenue ?? 0,
    revenueGrowthPct: metrics?.revenueGrowthPct ?? 0,
    totalRevenue: metrics?.totalRevenue ?? 0,
    pendingDocumentsCount: metrics?.pendingDocumentsCount ?? 0,
    workspaceHealthScore: metrics?.workspaceHealthScore ?? 100,
    completionRate: metrics?.completionRate ?? 0,
  };

  const cards = [
    {
      id: 'active_clients',
      label: 'Active Clients',
      value: safeMetrics.activeClientsCount.toString(),
      subtext: 'Active client accounts',
      icon: <Users className="w-5 h-5 text-[#43D6B0]" />,
      color: 'from-[#176B5B]/15 to-transparent',
      borderColor: 'border-[#176B5B]/30',
      actionView: 'clients',
    },
    {
      id: 'active_projects',
      label: 'Active Projects',
      value: safeMetrics.activeProjectsCount.toString(),
      subtext: `${safeMetrics.completionRate}% avg completion`,
      icon: <FolderKanban className="w-5 h-5 text-[#43D6B0]" />,
      color: 'from-[#176B5B]/15 to-transparent',
      borderColor: 'border-[#176B5B]/30',
      actionView: 'projects',
    },
    {
      id: 'pending_deliverables',
      label: 'Pending Deliverables',
      value: safeMetrics.pendingDeliverablesCount.toString(),
      subtext: 'Packages in review',
      icon: <FileCheck className="w-5 h-5 text-[#43D6B0]" />,
      color: 'from-[#176B5B]/15 to-transparent',
      borderColor: 'border-[#176B5B]/30',
      actionView: 'deliverables',
    },
    {
      id: 'pending_invoices',
      label: 'Pending Invoices',
      value: formatCurrency(safeMetrics.pendingInvoicesAmount, currency),
      subtext: `${safeMetrics.pendingInvoicesCount} invoices pending`,
      icon: <Receipt className="w-5 h-5 text-amber-400" />,
      color: 'from-amber-500/10 to-transparent',
      borderColor: 'border-amber-500/20',
      actionView: 'invoices',
    },
    {
      id: 'monthly_revenue',
      label: 'Monthly Revenue',
      value: formatCurrency(safeMetrics.monthlyRevenue, currency),
      subtext: `+${safeMetrics.revenueGrowthPct}% vs last month`,
      icon: <TrendingUp className="w-5 h-5 text-[#43D6B0]" />,
      color: 'from-[#176B5B]/15 to-transparent',
      borderColor: 'border-[#176B5B]/30',
      actionView: 'invoices',
    },
    {
      id: 'total_revenue',
      label: 'Total Revenue (YTD)',
      value: formatCurrency(safeMetrics.totalRevenue, currency),
      subtext: 'Settled & cleared',
      icon: <DollarSign className="w-5 h-5 text-amber-400" />,
      color: 'from-amber-500/10 to-transparent',
      borderColor: 'border-amber-500/20',
      actionView: 'invoices',
    },
    {
      id: 'missing_docs',
      label: 'Missing Documents',
      value: safeMetrics.pendingDocumentsCount.toString(),
      subtext: 'Client onboarding items',
      icon: <FileSearch className="w-5 h-5 text-rose-400" />,
      color: 'from-rose-500/10 to-transparent',
      borderColor: 'border-rose-500/20',
      actionView: 'documents',
    },
    {
      id: 'health_score',
      label: 'Workspace Health',
      value: `${safeMetrics.workspaceHealthScore}/100`,
      subtext: 'Optimal operational score',
      icon: <ShieldCheck className="w-5 h-5 text-[#43D6B0]" />,
      color: 'from-[#176B5B]/15 to-transparent',
      borderColor: 'border-[#176B5B]/30',
      actionView: 'dashboard',
    },
  ];

  return (
    <div className="bg-[#191F1D] border border-[#176B5B]/30 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-[#F5F5F0] tracking-tight flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-[#43D6B0]" /> Business Intelligence Snapshot
          </h2>
          <p className="text-sm text-[#A6B4AE] font-medium mt-1">High-level financial &amp; operational metrics across all client hubs.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.id}
            onClick={() => onNavigate(card.actionView)}
            className={`p-5 rounded-xl bg-gradient-to-br ${card.color} bg-[#191F1D] border ${card.borderColor} hover:border-[#43D6B0]/60 transition-all cursor-pointer group flex flex-col justify-between`}
          >
            <div className="flex items-start justify-between mb-3.5">
              <span className="p-2.5 rounded-lg bg-white/5 border border-white/10 group-hover:scale-105 transition-transform">
                {card.icon}
              </span>
              <ArrowUpRight className="w-5 h-5 text-[#A6B4AE] group-hover:text-white transition-colors" />
            </div>

            <div>
              <p className="text-sm font-semibold text-[#A6B4AE]">{card.label}</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold font-display text-[#F5F5F0] tracking-tight my-1 group-hover:text-[#43D6B0] transition-colors">
                {card.value}
              </h3>
              <p className="text-xs sm:text-sm text-[#A6B4AE] font-medium">{card.subtext}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
