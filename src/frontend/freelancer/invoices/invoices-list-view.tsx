import React, { useState, useEffect } from 'react';
import { Invoice, FinancialDashboardMetrics } from '@/shared/types';
import { InvoiceService } from '@/backend/freelancer';
import { formatCurrency } from '@/shared/utils/currency';
import { generateInvoicePDF, printInvoiceDocument } from '@/shared/utils/invoice-pdf';
import { InvoiceDashboard } from './components/invoice-dashboard';
import { DueIndicatorBadge, PaymentStatusPill, WorkflowStatusPill, RecurringInvoiceBadge } from './components/status-pills';
import { InvoiceBuilderModal } from './components/invoice-builder-modal';
import { InvoiceDetailsModal } from './components/invoice-details-modal';
import { MarkPaidModal } from './components/mark-paid-modal';
import { ClientInvoicePortalModal } from './components/client-invoice-portal-modal';
import {
  Plus,
  Search,
  FileText,
  CheckCircle2,
  Filter,
  ArrowUpDown,
  Download,
  Printer,
  Trash2,
  ExternalLink,
  Bell,
  BarChart3,
  ListFilter,
  DollarSign,
  ShieldCheck,
  Copy,
} from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';
import { useAuth } from '@/frontend/auth/auth-context';

export const InvoicesListView: React.FC = () => {
  const [viewMode, setViewMode] = useState<'dashboard' | 'directory'>('dashboard');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [metrics, setMetrics] = useState<FinancialDashboardMetrics>({
    lifetimeRevenue: 0,
    outstandingBalance: 0,
    paidThisMonth: 0,
    pendingPayments: 0,
    overdueAmount: 0,
    averageInvoiceValue: 0,
    paymentCollectionRate: 100,
    recentPayments: [],
    recentInvoices: [],
    upcomingDueDates: [],
    agingReport: [
      { range: '0-7 Days', amount: 0, count: 0, percentage: 0 },
      { range: '8-15 Days', amount: 0, count: 0, percentage: 0 },
      { range: '16-30 Days', amount: 0, count: 0, percentage: 0 },
      { range: '30+ Days', amount: 0, count: 0, percentage: 0 },
    ],
    paymentTrend: [],
  });

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'dueDate' | 'amountHigh'>('newest');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal triggers
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);

  const [detailsInvoice, setDetailsInvoice] = useState<Invoice | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [markPaidInvoice, setMarkPaidInvoice] = useState<Invoice | null>(null);
  const [isMarkPaidOpen, setIsMarkPaidOpen] = useState(false);

  const [portalInvoice, setPortalInvoice] = useState<Invoice | null>(null);
  const [isPortalOpen, setIsPortalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { showToast } = useToast();
  const { profile } = useAuth();

  const refreshData = async () => {
    try {
      const updatedInvoices = await InvoiceService.getInvoices();
      const updatedMetrics = await InvoiceService.getFinancialMetrics(updatedInvoices);
      setInvoices(updatedInvoices);
      setMetrics(updatedMetrics);

      // Keep active selected invoice up to date
      if (detailsInvoice) {
        const refreshedDetails = updatedInvoices.find(i => i.id === detailsInvoice.id);
        if (refreshedDetails) setDetailsInvoice(refreshedDetails);
      }
    } catch (err) {
      showToast('Error', 'Unable to load invoices. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data load (declared after refreshData so the effect sees it)
  useEffect(() => {
    const run = async () => {
      await refreshData();
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modal Handlers
  const handleOpenCreate = () => {
    setInvoiceToEdit(null);
    setIsBuilderOpen(true);
  };

  const handleOpenEdit = (inv: Invoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInvoiceToEdit(inv);
    setIsBuilderOpen(true);
  };

  const handleOpenDetails = (inv: Invoice) => {
    setDetailsInvoice(inv);
    setIsDetailsOpen(true);
  };

  const handleOpenMarkPaid = (inv: Invoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMarkPaidInvoice(inv);
    setIsMarkPaidOpen(true);
  };

  const handleOpenPortal = (inv: Invoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPortalInvoice(inv);
    setIsPortalOpen(true);
    // Record view in store
    InvoiceService.recordInvoiceView(inv.id).then(() => refreshData());
  };

  const handleSaveInvoice = async (payload: any) => {
    setIsSaving(true);
    try {
      showToast(
        invoiceToEdit ? 'Invoice Updated' : 'Invoice Created',
        `Invoice ${payload.invoiceNumber} ${invoiceToEdit ? 'updated' : 'created and recorded'}.`,
        'success'
      );
      if (invoiceToEdit) {
        setInvoices((prev) => prev.map((inv) => (inv.id === payload.id ? { ...inv, ...payload } : inv)));
      } else if (payload?.id) {
        setInvoices((prev) => [payload, ...prev]);
      }
      await refreshData();
    } catch (err) {
      showToast('Error', err instanceof Error ? err.message : 'Unable to refresh invoices.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmPaidOffline = async (id: string, paymentMethod: string, notes?: string, amount?: number) => {
    try {
      await InvoiceService.markInvoicePaidOffline(id, paymentMethod, notes, amount);
      showToast('Settlement Recorded', 'Invoice payment recorded successfully.', 'success');
      await refreshData();
    } catch (err) {
      showToast('Error', err instanceof Error ? err.message : 'Payment could not be recorded.', 'error');
    }
  };

  const handleSendReminder = async (id: string) => {
    try {
      const res = await InvoiceService.sendReminder(id);
      if (res.success) {
        showToast('Reminder Recorded', res.message, 'success');
        if (res.invoice) {
          setInvoices((prev) =>
            prev.map((inv) => (inv.id === id ? res.invoice! : inv))
          );
          if (detailsInvoice && detailsInvoice.id === id) {
            setDetailsInvoice(res.invoice);
          }
        }
      } else {
        showToast('Reminder', res.message, 'info');
      }
      return res;
    } catch (err) {
      showToast('Error', 'Failed to record reminder.', 'error');
    }
  };

  const handleDuplicateInvoice = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const duplicated = await InvoiceService.duplicateInvoice(id);
      if (duplicated) {
        showToast('Invoice Duplicated', `Created new statement #${duplicated.invoiceNumber}`, 'success');
        await refreshData();
      } else {
        showToast('Error', 'Failed to duplicate invoice.', 'error');
      }
    } catch (err) {
      showToast('Error', 'Could not duplicate invoice.', 'error');
    }
  };

  // Bulk Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredInvoices.map((i) => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkMarkPaid = async () => {
    try {
      for (const id of selectedIds) {
        await InvoiceService.markInvoicePaidOffline(id, 'bank_transfer', 'Bulk offline settlement');
      }
      showToast('Bulk Action Complete', `${selectedIds.length} invoice(s) marked as paid.`, 'success');
      setSelectedIds([]);
      await refreshData();
    } catch (err) {
      showToast('Error', 'Some invoices could not be updated.', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} invoice(s)? This cannot be undone.`)) return;
    try {
      for (const id of selectedIds) {
        await InvoiceService.deleteInvoice(id);
      }
      showToast('Invoices Deleted', `${selectedIds.length} invoice(s) deleted.`, 'info');
      setSelectedIds([]);
      await refreshData();
    } catch (err) {
      showToast('Error', 'Some invoices could not be deleted.', 'error');
    }
  };

  // Filter & Sort Logic
  const filteredInvoices = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.clientName.toLowerCase().includes(q) ||
      (inv.projectName && inv.projectName.toLowerCase().includes(q));

    const matchesWorkflow = workflowFilter === 'all' || inv.workflowStatus === workflowFilter;
    const matchesPayment = paymentFilter === 'all' || inv.paymentStatus === paymentFilter;
    const matchesCurrency = currencyFilter === 'all' || inv.currency === currencyFilter;

    return matchesSearch && matchesWorkflow && matchesPayment && matchesCurrency;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
    if (sortBy === 'oldest') return new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime();
    if (sortBy === 'dueDate') return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (sortBy === 'amountHigh') return b.total - a.total;
    return 0;
  });

  return (
    <div className="space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#2A2A2A]">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Invoice & Financial Workspace
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            FlowDesk Financial Overview • Streamlined billing and settlement tracking for freelancers
          </p>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center p-1 bg-[#101312] border border-[#176B5B]/30 rounded-xl text-xs">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-3.5 py-1.5 font-bold rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'dashboard'
                  ? 'bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/50 shadow-sm'
                  : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button
              onClick={() => setViewMode('directory')}
              className={`px-3.5 py-1.5 font-bold rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'directory'
                  ? 'bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/50 shadow-sm'
                  : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" /> All Invoices ({invoices.length})
            </button>
          </div>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-[#43D6B0] hover:bg-[#43D6B0]/90 text-[#101312] text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#43D6B0]/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Invoice
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-400">Loading invoices...</p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {!isLoading && (viewMode === 'dashboard' ? (
        <InvoiceDashboard
          metrics={metrics}
          onSelectInvoice={handleOpenDetails}
          onCreateInvoice={handleOpenCreate}
        />
      ) : (
        <div className="space-y-4">
          {/* Controls Bar: Search, Filters, Sort */}
          <div className="p-4 rounded-2xl border border-white/10 bg-zinc-950/80 shadow-2xl backdrop-blur-xl space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search invoice #, client, or project..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 border border-[#176B5B]/30 rounded-xl bg-[#191F1D] text-[#F5F5F0] placeholder-[#A6B4AE]/60 focus:outline-none focus:border-[#43D6B0] focus:ring-1 focus:ring-[#43D6B0]/40 transition-colors text-xs"
                />
              </div>

              {/* Filter Selectors */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                {/* Workflow Status Filter */}
                <select
                  value={workflowFilter}
                  onChange={(e) => setWorkflowFilter(e.target.value)}
                  className="px-3 py-2.5 border border-[#176B5B]/30 rounded-xl bg-[#191F1D] text-[#F5F5F0] focus:outline-none focus:border-[#43D6B0] transition-colors text-xs"
                >
                  <option value="all">Workflow: All</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="viewed">Viewed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                {/* Payment Status Filter */}
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="px-3 py-2.5 border border-[#176B5B]/30 rounded-xl bg-[#191F1D] text-[#F5F5F0] focus:outline-none focus:border-[#43D6B0] transition-colors text-xs"
                >
                  <option value="all">Payment: All</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>

                {/* Currency Filter */}
                <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value)}
                  className="px-3 py-2.5 border border-[#176B5B]/30 rounded-xl bg-[#191F1D] text-[#F5F5F0] focus:outline-none focus:border-[#43D6B0] transition-colors text-xs"
                >
                  <option value="all">Currency: All</option>
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>

                {/* Sort selector */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2.5 border border-[#176B5B]/30 rounded-xl bg-[#191F1D] text-[#F5F5F0] focus:outline-none focus:border-[#43D6B0] transition-colors text-xs"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="dueDate">Sort: Due Date Asc</option>
                  <option value="amountHigh">Sort: Amount High-Low</option>
                </select>
              </div>
            </div>

            {/* Bulk Selection Bar */}
            {selectedIds.length > 0 && (
              <div className="p-3 rounded-xl bg-[#141817] border border-[#176B5B]/30 text-white flex items-center justify-between text-xs animate-in fade-in">
                <span className="font-bold font-mono pl-2 text-[#F5F5F0]">
                  {selectedIds.length} invoice(s) selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkMarkPaid}
                    className="px-3 py-1.5 rounded-lg bg-[#176B5B] hover:bg-[#176B5B]/80 text-[#F5F5F0] font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Invoices Card List (Phone < 768px) */}
          <div className="block md:hidden space-y-3">
            {sortedInvoices.length === 0 ? (
              <div className="p-10 text-center text-xs text-[#A6B4AE] border border-[#176B5B]/30 rounded-2xl bg-[#191F1D]">
                No invoices found matching current criteria
              </div>
            ) : (
              sortedInvoices.map((inv) => {
                const isSelected = selectedIds.includes(inv.id);
                return (
                  <div
                    key={inv.id}
                    onClick={() => handleOpenDetails(inv)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer bg-[#191F1D] shadow-lg space-y-3 ${
                      isSelected ? 'border-[#43D6B0] bg-[#176B5B]/15' : 'border-[#176B5B]/30 hover:border-[#176B5B]/60'
                    }`}
                  >
                    {/* Header: Checkbox + Number + Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleToggleSelect(inv.id, e as any)}
                          className="rounded border-[#176B5B]/40 bg-[#101312] text-[#43D6B0] focus:ring-[#43D6B0]/40 accent-[#43D6B0] w-4 h-4 cursor-pointer"
                        />
                        <div>
                          <div className="font-bold font-mono text-white text-sm flex items-center gap-1.5">
                            <span>{inv.invoiceNumber}</span>
                            <RecurringInvoiceBadge scheduleId={(inv as any).recurringScheduleId || (inv as any).recurring_schedule_id} />
                          </div>
                          <div className="text-xs text-zinc-400 font-medium">{inv.clientName}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <PaymentStatusPill status={inv.paymentStatus} />
                        <WorkflowStatusPill status={inv.workflowStatus} />
                      </div>
                    </div>

                    {/* Middle: Project & Due Date & Amount */}
                    <div className="pt-2 border-t border-[#176B5B]/20 flex items-center justify-between text-xs">
                      <div className="space-y-1">
                        {inv.projectName && (
                          <div className="text-zinc-300 font-medium max-w-[180px] truncate text-[11px]">
                            📁 {inv.projectName}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <DueIndicatorBadge
                            dueDate={inv.dueDate}
                            paymentStatus={inv.paymentStatus}
                            workflowStatus={inv.workflowStatus}
                          />
                          <span className="text-[10px] text-zinc-500 font-mono">Due: {inv.dueDate}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-extrabold font-mono text-[#43D6B0]">
                          {formatCurrency(inv.total, inv.currency)}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono uppercase">{inv.currency}</div>
                      </div>
                    </div>

                    {/* Bottom Actions Row */}
                    <div
                      className="pt-2 border-t border-[#176B5B]/20 flex items-center justify-end gap-1.5 flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(inv)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#43D6B0]" /> Details
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenPortal(inv, e)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#43D6B0]" /> Portal
                      </button>
                      {inv.paymentStatus !== 'paid' && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenMarkPaid(inv, e)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Pay
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(inv, e)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        title="Edit Invoice"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete invoice ${inv.invoiceNumber}?`)) {
                            await InvoiceService.deleteInvoice(inv.id);
                            showToast('Deleted', `Invoice ${inv.invoiceNumber} removed.`, 'info');
                            await refreshData();
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-400 transition-colors"
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Directory Table */}
          <div className="hidden md:block border border-[#176B5B]/30 rounded-2xl overflow-x-auto w-full bg-[#191F1D] shadow-2xl backdrop-blur-xl">
            <table className="w-full text-left border-collapse text-xs min-w-[720px]">
              <thead>
                <tr className="bg-[#141817] border-b border-[#176B5B]/30 font-bold text-[#A6B4AE]">
                  <th className="p-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredInvoices.length && filteredInvoices.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-[#176B5B]/40 bg-[#101312] text-[#43D6B0] focus:ring-[#43D6B0]/40 accent-[#43D6B0]"
                    />
                  </th>
                  <th className="p-4">Invoice # & Client</th>
                  <th className="p-4">Project</th>
                  <th className="p-4">Issue / Due Date</th>
                  <th className="p-4">Workflow</th>
                  <th className="p-4">Payment</th>
                  <th className="p-4 text-right">Total Amount</th>
                  <th className="p-4 text-center">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#176B5B]/20">
                {sortedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-14 text-center text-[#A6B4AE]">
                      No invoices found matching current criteria
                    </td>
                  </tr>
                ) : (
                  sortedInvoices.map((inv) => {
                    const isSelected = selectedIds.includes(inv.id);
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => handleOpenDetails(inv)}
                        className={`hover:bg-[#176B5B]/10 cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#176B5B]/15' : ''
                        }`}
                      >
                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleToggleSelect(inv.id, e as any)}
                            className="rounded border-white/20 bg-zinc-900 text-white focus:ring-0"
                          />
                        </td>

                        <td className="p-4">
                          <div className="font-bold font-mono text-white flex items-center gap-2">
                            <span>{inv.invoiceNumber}</span>
                            <RecurringInvoiceBadge scheduleId={(inv as any).recurringScheduleId || (inv as any).recurring_schedule_id} />
                          </div>
                          <div className="text-zinc-400 font-medium mt-0.5">
                            {inv.clientName}
                          </div>
                        </td>

                        <td className="p-4 text-zinc-300 max-w-[180px] truncate">
                          {inv.projectName || <span className="text-zinc-500 italic">No Project</span>}
                        </td>

                        <td className="p-4 space-y-1">
                          <div className="font-mono text-zinc-400">{inv.issueDate}</div>
                          <DueIndicatorBadge
                            dueDate={inv.dueDate}
                            paymentStatus={inv.paymentStatus}
                            workflowStatus={inv.workflowStatus}
                          />
                        </td>

                        <td className="p-4">
                          <WorkflowStatusPill status={inv.workflowStatus} />
                        </td>

                        <td className="p-4">
                          <PaymentStatusPill status={inv.paymentStatus} />
                        </td>

                        <td className="p-4 text-right font-mono font-bold text-white">
                          {formatCurrency(inv.total, inv.currency)}
                        </td>

                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {inv.paymentStatus !== 'paid' && (
                              <button
                                onClick={(e) => handleOpenMarkPaid(inv, e)}
                                title="Mark Paid (Offline)"
                                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {inv.paymentStatus !== 'paid' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendReminder(inv.id);
                                }}
                                title="Send Payment Reminder"
                                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors"
                              >
                                <Bell className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={(e) => handleOpenPortal(inv, e)}
                              title="Client Portal View"
                              className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                generateInvoicePDF(inv, profile);
                              }}
                              title="Download PDF"
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                printInvoiceDocument(inv, profile);
                              }}
                              title="Print Invoice"
                              className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-white/10 transition-colors cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleDuplicateInvoice(inv.id, e)}
                              title="Duplicate Invoice (New Sequential Number)"
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleOpenEdit(inv, e)}
                              title="Edit Invoice"
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Builder Modal */}
      <InvoiceBuilderModal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        invoiceToEdit={invoiceToEdit}
        onSave={handleSaveInvoice}
      />

      {/* Details Modal */}
      <InvoiceDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        invoice={detailsInvoice}
        profile={profile}
        onMarkPaid={(inv) => {
          setIsDetailsOpen(false);
          handleOpenMarkPaid(inv);
        }}
        onSendReminder={handleSendReminder}
        onOpenPortalView={(inv) => {
          setIsDetailsOpen(false);
          handleOpenPortal(inv);
        }}
        onDelete={async (id) => {
          try {
            setInvoices((prev) => prev.filter((item) => item.id !== id));
            await InvoiceService.deleteInvoice(id);
            showToast('Invoice Deleted', 'Invoice has been deleted.', 'info');
            await refreshData();
          } catch (err) {
            showToast('Error', 'Unable to delete invoice.', 'error');
            await refreshData();
          }
        }}
      />

      {/* Mark Paid Modal — keyed by invoice so state resets per invoice */}
      <MarkPaidModal
        key={markPaidInvoice?.id || 'closed'}
        isOpen={isMarkPaidOpen}
        onClose={() => setIsMarkPaidOpen(false)}
        invoice={markPaidInvoice}
        onConfirmPaid={handleConfirmPaidOffline}
      />

      {/* Client Portal Modal */}
      <ClientInvoicePortalModal
        isOpen={isPortalOpen}
        onClose={() => setIsPortalOpen(false)}
        invoice={portalInvoice}
        profile={profile}
      />
    </div>
  );
};
