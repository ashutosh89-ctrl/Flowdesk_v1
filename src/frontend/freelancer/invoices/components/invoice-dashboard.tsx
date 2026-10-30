import React from 'react';
import { FinancialDashboardMetrics, Invoice } from '@/shared/types';
import { formatCurrency } from '@/shared/utils/currency';
import { DueIndicatorBadge } from './status-pills';
import { Progress } from '@/frontend/shared/ui/progress';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Receipt,
} from 'lucide-react';
import { useAuth } from '@/frontend/auth/auth-context';

interface InvoiceDashboardProps {
  metrics: FinancialDashboardMetrics;
  onSelectInvoice: (invoice: Invoice) => void;
  onCreateInvoice: () => void;
  currency?: string;
}

export function InvoiceDashboard({ metrics, onSelectInvoice, onCreateInvoice, currency: propCurrency }: InvoiceDashboardProps) {
  const { profile, userSettings } = useAuth();
  const currency = propCurrency || userSettings?.currency || profile?.currency || 'INR';

  const safeMetrics: FinancialDashboardMetrics = {
    lifetimeRevenue: metrics?.lifetimeRevenue ?? 0,
    outstandingBalance: metrics?.outstandingBalance ?? 0,
    paidThisMonth: metrics?.paidThisMonth ?? 0,
    pendingPayments: metrics?.pendingPayments ?? 0,
    overdueAmount: metrics?.overdueAmount ?? 0,
    averageInvoiceValue: metrics?.averageInvoiceValue ?? 0,
    paymentCollectionRate: metrics?.paymentCollectionRate ?? 100,
    recentPayments: metrics?.recentPayments ?? [],
    recentInvoices: metrics?.recentInvoices ?? [],
    upcomingDueDates: metrics?.upcomingDueDates ?? [],
    agingReport: metrics?.agingReport?.length
      ? metrics.agingReport
      : [
          { range: '0-7 Days', amount: 0, count: 0, percentage: 0 },
          { range: '8-15 Days', amount: 0, count: 0, percentage: 0 },
          { range: '16-30 Days', amount: 0, count: 0, percentage: 0 },
          { range: '30+ Days', amount: 0, count: 0, percentage: 0 },
        ],
    paymentTrend: metrics?.paymentTrend ?? [],
  };

  const pendingInvoiceCount = safeMetrics.agingReport.reduce((acc, r) => acc + r.count, 0);

  return (
    <div className="space-y-6 select-none">
      {/* Executive Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lifetime Revenue */}
        <div className="p-5 rounded-2xl border border-white/10 bg-[#16181B] hover:border-white/20 transition-all space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Lifetime Revenue</span>
            <Receipt className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-white font-mono">
            {formatCurrency(safeMetrics.lifetimeRevenue, currency)}
          </div>
          <p className="text-xs text-zinc-400">
            Avg. {formatCurrency(safeMetrics.averageInvoiceValue, currency)} per invoice
          </p>
        </div>

        {/* Outstanding Balance */}
        <div className="p-5 rounded-2xl border border-white/10 bg-[#16181B] hover:border-white/20 transition-all space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Outstanding Balance</span>
            <Clock className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-white font-mono">
            {formatCurrency(safeMetrics.outstandingBalance, currency)}
          </div>
          <p className="text-xs text-zinc-400">
            {pendingInvoiceCount} {pendingInvoiceCount === 1 ? 'invoice' : 'invoices'} pending settlement
          </p>
        </div>

        {/* Paid This Month */}
        <div className="p-5 rounded-2xl border border-white/10 bg-[#16181B] hover:border-white/20 transition-all space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Paid This Month</span>
            <CheckCircle2 className="w-4 h-4 text-[#43D6B0]" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-white font-mono">
            {formatCurrency(safeMetrics.paidThisMonth, currency)}
          </div>
          <p className="text-xs text-zinc-400">
            {safeMetrics.paymentCollectionRate}% collection rate
          </p>
        </div>

        {/* Overdue Amount */}
        <div className="p-5 rounded-2xl border border-white/10 bg-[#16181B] hover:border-white/20 transition-all space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Overdue Amount</span>
            <AlertCircle className={`w-4 h-4 ${safeMetrics.overdueAmount > 0 ? 'text-rose-400' : 'text-zinc-500'}`} />
          </div>
          <div className={`text-2xl font-bold tracking-tight font-mono ${safeMetrics.overdueAmount > 0 ? 'text-rose-400' : 'text-white'}`}>
            {formatCurrency(safeMetrics.overdueAmount, currency)}
          </div>
          <p className="text-xs text-zinc-400">
            {safeMetrics.overdueAmount > 0 ? 'Requires client follow-up' : 'All invoices current'}
          </p>
        </div>
      </div>

      {/* Main Grid: Aging Breakdown + Upcoming Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aging Breakdown (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-white/10 bg-[#16181B] space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#43D6B0]" />
                Invoicing Aging Breakdown
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Outstanding balances categorized by payment latency
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-[#121417] border border-white/10 text-zinc-300 font-mono font-medium">
              Total: {formatCurrency(safeMetrics.outstandingBalance, currency)}
            </span>
          </div>

          {/* Aging Items List */}
          <div className="space-y-4">
            {safeMetrics.agingReport.map((item) => (
              <div
                key={item.range}
                className="p-3.5 rounded-xl border border-white/10 bg-[#121417] space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{item.range}</span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      ({item.count} {item.count === 1 ? 'invoice' : 'invoices'})
                    </span>
                  </div>
                  <span className="font-mono font-bold text-white text-sm">
                    {formatCurrency(item.amount, currency)}
                  </span>
                </div>
                <Progress value={item.percentage} size="xs" />
              </div>
            ))}
          </div>

          {/* Monthly Trend Clean Row */}
          {safeMetrics.paymentTrend.length > 0 && (
            <div className="pt-4 border-t border-white/10 space-y-3">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Quarterly Revenue & Pending Trend
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {safeMetrics.paymentTrend.map((t) => (
                  <div key={t.month} className="p-3 rounded-xl border border-white/10 bg-[#121417] text-center space-y-1">
                    <div className="text-xs text-zinc-400 font-medium">{t.month}</div>
                    <div className="text-xs font-bold text-white font-mono">
                      {formatCurrency(t.paid, currency)}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      {t.pending > 0 ? `${formatCurrency(t.pending, currency)} pending` : 'Settled'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upcoming Due Dates Panel (1 col) */}
        <div className="p-6 rounded-2xl border border-white/10 bg-[#16181B] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-zinc-400" />
              Upcoming Due Invoices
            </h3>
            <button
              onClick={onCreateInvoice}
              className="text-xs text-[#43D6B0] hover:text-[#52e8c2] font-semibold flex items-center gap-1 transition-colors"
            >
              + Create <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {safeMetrics.upcomingDueDates.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-white/10 rounded-xl">
                No upcoming invoices due
              </div>
            ) : (
              safeMetrics.upcomingDueDates.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => onSelectInvoice(inv)}
                  className="p-3.5 rounded-xl border border-white/10 hover:border-white/20 bg-[#121417] hover:bg-[#181a1f] cursor-pointer transition-all space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-white group-hover:text-[#43D6B0] transition-colors">
                      {inv.invoiceNumber}
                    </span>
                    <DueIndicatorBadge
                      dueDate={inv.dueDate}
                      paymentStatus={inv.paymentStatus}
                      workflowStatus={inv.workflowStatus}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="truncate max-w-[140px]">{inv.clientName}</span>
                    <span className="font-bold text-white font-mono">
                      {formatCurrency(inv.total, inv.currency || currency)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-white/10 text-xs text-zinc-400 flex items-center justify-between">
            <span>Total Issued Invoices</span>
            <span className="font-mono font-bold text-white">
              {safeMetrics.recentInvoices.length} Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InvoiceDashboard;
