import React from 'react';
import { FinancialDashboardMetrics, Invoice } from '@/shared/types';
import { formatCurrency } from '@/shared/utils/currency';
import { DueIndicatorBadge, PaymentStatusPill, WorkflowStatusPill } from './status-pills';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  FileText,
} from 'lucide-react';

interface InvoiceDashboardProps {
  metrics: FinancialDashboardMetrics;
  onSelectInvoice: (invoice: Invoice) => void;
  onCreateInvoice: () => void;
}

export function InvoiceDashboard({ metrics, onSelectInvoice, onCreateInvoice }: InvoiceDashboardProps) {
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

  return (
    <div className="space-y-6 select-none">
      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lifetime Revenue */}
        <div className="p-5 rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Lifetime Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-white">
            {formatCurrency(safeMetrics.lifetimeRevenue, 'USD')}
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Avg: {formatCurrency(safeMetrics.averageInvoiceValue, 'USD')}</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Settled
            </span>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="p-5 rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Outstanding Balance</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-white">
            {formatCurrency(safeMetrics.outstandingBalance, 'USD')}
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Pending: {formatCurrency(safeMetrics.pendingPayments, 'USD')}</span>
            <span className="text-amber-400 font-medium">Awaiting Payout</span>
          </div>
        </div>

        {/* Paid This Month */}
        <div className="p-5 rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Paid This Month</span>
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-white">
            {formatCurrency(safeMetrics.paidThisMonth, 'USD')}
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Collection Rate</span>
            <span className="text-sky-400 font-medium">{safeMetrics.paymentCollectionRate}%</span>
          </div>
        </div>

        {/* Overdue Amount */}
        <div className="p-5 rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Overdue Amount</span>
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-rose-400">
            {formatCurrency(safeMetrics.overdueAmount, 'USD')}
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Action Required</span>
            <span className="text-rose-400 font-medium">Follow Up</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Aging Report + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aging Report (2 cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Invoicing Aging Breakdown
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Outstanding balances categorized by payment latency
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-zinc-300 font-mono">
              Total: {formatCurrency(safeMetrics.outstandingBalance, 'USD')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {safeMetrics.agingReport.map((item) => (
              <div
                key={item.range}
                className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-200">{item.range}</span>
                  <span className="text-zinc-400 font-mono text-[11px]">{item.count} invoice{item.count === 1 ? '' : 's'}</span>
                </div>
                <div className="text-lg font-bold text-white">
                  {formatCurrency(item.amount, 'USD')}
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      item.range === '30+ Days'
                        ? 'bg-rose-500'
                        : item.range === '16-30 Days'
                        ? 'bg-amber-500'
                        : item.range === '8-15 Days'
                        ? 'bg-sky-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, item.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Monthly Trend Mini Visualizer */}
          <div className="pt-4 border-t border-white/10">
            <h4 className="text-xs font-semibold text-zinc-300 mb-3">
              Quarterly Revenue vs Pending Trend
            </h4>
            <div className="grid grid-cols-4 gap-2">
              {safeMetrics.paymentTrend.map((t) => (
                <div key={t.month} className="p-2.5 rounded-xl border border-white/10 bg-zinc-900/40 text-center">
                  <div className="text-xs text-zinc-400 mb-1">{t.month}</div>
                  <div className="text-xs font-bold text-emerald-400 font-mono">
                    {formatCurrency(t.paid, 'USD')}
                  </div>
                  <div className="text-[10px] text-amber-400 font-mono mt-0.5">
                    {formatCurrency(t.pending, 'USD')} pending
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Due Dates & Action Panel (1 col) */}
        <div className="p-6 rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              Upcoming Due Invoices
            </h3>
            <button
              onClick={onCreateInvoice}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors"
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
                  className="p-3.5 rounded-xl border border-white/10 hover:border-white/20 bg-zinc-900/60 hover:bg-zinc-900/90 cursor-pointer transition-all space-y-1.5 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-white group-hover:text-amber-300 transition-colors">
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
                      {formatCurrency(inv.total, inv.currency)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-white/10 text-xs text-zinc-400 flex items-center justify-between">
            <span>Total Issued Invoices:</span>
            <span className="font-mono font-bold text-white">
              {safeMetrics.recentInvoices.length} Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
