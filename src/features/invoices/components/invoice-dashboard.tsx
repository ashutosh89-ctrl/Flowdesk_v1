import React from 'react';
import { FinancialDashboardMetrics, Invoice } from '../../../types';
import { formatCurrency } from '../../../utils/currency';
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
  return (
    <div className="space-y-6">
      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lifetime Revenue */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Lifetime Revenue</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {formatCurrency(metrics.lifetimeRevenue, 'USD')}
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Avg Invoice: {formatCurrency(metrics.averageInvoiceValue, 'USD')}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> Settled
            </span>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Outstanding Balance</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {formatCurrency(metrics.outstandingBalance, 'USD')}
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Pending: {formatCurrency(metrics.pendingPayments, 'USD')}</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">Awaiting Payout</span>
          </div>
        </div>

        {/* Paid This Month */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Paid This Month</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {formatCurrency(metrics.paidThisMonth, 'USD')}
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Collection Rate</span>
            <span className="text-blue-600 dark:text-blue-400 font-medium">{metrics.paymentCollectionRate}%</span>
          </div>
        </div>

        {/* Overdue Amount */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Overdue Amount</span>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-rose-600 dark:text-rose-400">
            {formatCurrency(metrics.overdueAmount, 'USD')}
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Action Required</span>
            <span className="text-rose-600 dark:text-rose-400 font-medium">Follow Up</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Aging Report + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Aging Report (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-zinc-500" />
                Invoicing Aging Breakdown
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Outstanding balances categorized by payment latency
              </p>
            </div>
            <span className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
              Total: {formatCurrency(metrics.outstandingBalance, 'USD')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {metrics.agingReport.map((item) => (
              <div
                key={item.range}
                className="p-3.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.range}</span>
                  <span className="text-zinc-500 font-mono">{item.count} invoice{item.count === 1 ? '' : 's'}</span>
                </div>
                <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(item.amount, 'USD')}
                </div>
                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
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
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
            <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-3">
              Quarterly Revenue vs Pending Trend
            </h4>
            <div className="grid grid-cols-4 gap-2">
              {metrics.paymentTrend.map((t) => (
                <div key={t.month} className="p-2 rounded border border-zinc-100 dark:border-zinc-800/60 text-center">
                  <div className="text-xs text-zinc-400 mb-1">{t.month}</div>
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(t.paid, 'USD')}
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                    {formatCurrency(t.pending, 'USD')} pending
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Due Dates & Action Panel (1 col) */}
        <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              Upcoming Due Invoices
            </h3>
            <button
              onClick={onCreateInvoice}
              className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 font-medium flex items-center gap-1"
            >
              + Create <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {metrics.upcomingDueDates.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 border border-dashed rounded-lg">
                No upcoming invoices due
              </div>
            ) : (
              metrics.upcomingDueDates.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => onSelectInvoice(inv)}
                  className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/30 dark:bg-zinc-900/40 cursor-pointer transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium font-mono text-zinc-900 dark:text-zinc-100">
                      {inv.invoiceNumber}
                    </span>
                    <DueIndicatorBadge
                      dueDate={inv.dueDate}
                      paymentStatus={inv.paymentStatus}
                      workflowStatus={inv.workflowStatus}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="truncate max-w-[140px]">{inv.clientName}</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
                      {formatCurrency(inv.total, inv.currency)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
            <span>Total Issued Invoices:</span>
            <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
              {metrics.recentInvoices.length} Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
