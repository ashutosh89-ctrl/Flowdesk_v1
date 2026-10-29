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
    completionRate: metrics?.completionRate ?? 0,
  };

  const cards = [
    {
      id: 'monthly_revenue',
      label: 'Monthly Revenue',
      value: formatCurrency(safeMetrics.monthlyRevenue, currency),
      subtext: `+${safeMetrics.revenueGrowthPct}% vs last month`,
      icon: <TrendingUp className="w-5 h-5 text-[#43D6B0]" />,
      actionView: 'invoices',
    },
    {
      id: 'total_revenue',
      label: 'Total Revenue (YTD)',
      value: formatCurrency(safeMetrics.totalRevenue, currency),
      subtext: 'Settled & cleared',
      icon: <DollarSign className="w-5 h-5 text-[#43D6B0]" />,
      actionView: 'invoices',
    },
    {
      id: 'pending_invoices',
      label: 'Pending Invoices',
      value: formatCurrency(safeMetrics.pendingInvoicesAmount, currency),
      subtext: `${safeMetrics.pendingInvoicesCount} invoice${safeMetrics.pendingInvoicesCount === 1 ? '' : 's'} awaiting settlement`,
      icon: <Receipt className="w-5 h-5 text-[#43D6B0]" />,
      actionView: 'invoices',
    },
    {
      id: 'active_clients',
      label: 'Active Clients',
      value: safeMetrics.activeClientsCount.toString(),
      subtext: 'Client workspaces',
      icon: <Users className="w-5 h-5 text-[#43D6B0]" />,
      actionView: 'clients',
    },
    {
      id: 'active_projects',
      label: 'Active Projects',
      value: safeMetrics.activeProjectsCount.toString(),
      subtext: `${safeMetrics.completionRate}% avg milestone completion`,
      icon: <FolderKanban className="w-5 h-5 text-[#43D6B0]" />,
      actionView: 'projects',
    },
    {
      id: 'pending_deliverables',
      label: 'Pending Deliverables',
      value: safeMetrics.pendingDeliverablesCount.toString(),
      subtext: 'Packages in review / revision',
      icon: <FileCheck className="w-5 h-5 text-[#43D6B0]" />,
      actionView: 'deliverables',
    },
  ];

  return (
    <div className="bg-[#191F1D] border border-[#176B5B]/30 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#F5F5F0] tracking-tight flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-[#43D6B0]" /> Business Snapshot
          </h2>
          <p className="text-xs sm:text-sm text-[#A6B4AE] font-medium mt-1">
            Financial &amp; operational metrics across all client engagements.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.id}
            onClick={() => onNavigate(card.actionView)}
            className="p-5 rounded-xl bg-[#101312]/60 hover:bg-[#101312] border border-[#176B5B]/30 hover:border-[#43D6B0]/50 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-start justify-between mb-3.5">
              <span className="p-2 rounded-lg bg-[#176B5B]/20 border border-[#176B5B]/35 text-[#43D6B0] transition-colors">
                {card.icon}
              </span>
              <ArrowUpRight className="w-4 h-4 text-[#A6B4AE] group-hover:text-[#43D6B0] transition-colors" />
            </div>

            <div>
              <p className="text-xs sm:text-sm font-semibold text-[#A6B4AE]">{card.label}</p>
              <h3 className="text-xl sm:text-2xl font-bold text-[#F5F5F0] tracking-tight my-1 group-hover:text-[#43D6B0] transition-colors">
                {card.value}
              </h3>
              <p className="text-[11px] sm:text-xs text-[#A6B4AE]/80 font-medium">{card.subtext}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
