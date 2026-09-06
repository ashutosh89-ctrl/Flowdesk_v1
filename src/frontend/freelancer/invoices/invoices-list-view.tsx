import React, { useState, useEffect } from 'react';
import { Invoice, FinancialDashboardMetrics } from '@/shared/types';
import { InvoiceService } from '@/backend/freelancer';
import { formatCurrency } from '@/shared/utils/currency';
import { generateInvoicePDF, printInvoiceDocument } from '@/shared/utils/invoice-pdf';
import { InvoiceDashboard } from './components/invoice-dashboard';
import { DueIndicatorBadge, PaymentStatusPill, WorkflowStatusPill } from './components/status-pills';
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
      const updatedMetrics = await InvoiceService.getFinancialMetrics();
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
      if (invoiceToEdit) {
        await InvoiceService.updateInvoice(invoiceToEdit.id, payload);
        showToast('Invoice Updated', `Invoice ${payload.invoiceNumber} saved successfully.`, 'success');
      } else {
        await InvoiceService.createInvoice(payload);
        showToast('Invoice Created', `Invoice ${payload.invoiceNumber} created and recorded.`, 'success');
      }
      await refreshData();
    } catch (err) {
      showToast('Error', err instanceof Error ? err.message : 'Unable to save invoice.', 'error');
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
      showToast('Error', 'Payment could not be recorded.', 'error');
    }
  };

  const handleSendReminder = async (id: string) => {
    try {
      const res = await InvoiceService.sendReminder(id);
      if (res.success) {
        showToast('Reminder Recorded', res.message, 'success');
      } else {
        showToast('Reminder', res.message, 'info');
      }
      await refreshData();
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Invoice & Financial Workspace
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            FlowDesk Financial Engine • Lightweight, modern settlements for freelancers
          </p>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center p-1 bg-zinc-950/80 border border-white/10 rounded-xl text-xs">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-3.5 py-1.5 font-bold rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'dashboard'
                  ? 'bg-white text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button
              onClick={() => setViewMode('directory')}
              className={`px-3.5 py-1.5 font-bold rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'directory'
                  ? 'bg-white text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" /> All Invoices ({invoices.length})
            </button>
          </div>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-white hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
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
                  className="w-full pl-10 pr-3.5 py-2.5 border border-white/10 rounded-xl bg-zinc-900/80 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-colors text-xs"
                />
              </div>

              {/* Filter Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Workflow Status Filter */}
                <select
                  value={workflowFilter}
                  onChange={(e) => setWorkflowFilter(e.target.value)}
                  className="px-3 py-2.5 border border-white/10 rounded-xl bg-zinc-900/80 text-zinc-200 focus:outline-none focus:border-white/30 transition-colors text-xs"
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
                  className="px-3 py-2.5 border border-white/10 rounded-xl bg-zinc-900/80 text-zinc-200 focus:outline-none focus:border-white/30 transition-colors text-xs"
                >
                  <option value="all">Payment: All</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>

                {/* Currency Filter */}
                <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value)}
                  className="px-3 py-2.5 border border-white/10 rounded-xl bg-zinc-900/80 text-zinc-200 focus:outline-none focus:border-white/30 transition-colors text-xs"
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
                  className="px-3 py-2.5 border border-white/10 rounded-xl bg-zinc-900/80 text-zinc-200 focus:outline-none focus:border-white/30 transition-colors text-xs"
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
              <div className="p-3 rounded-xl bg-zinc-900 border border-white/15 text-white flex items-center justify-between text-xs animate-in fade-in">
                <span className="font-bold font-mono pl-2">
                  {selectedIds.length} invoice(s) selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkMarkPaid}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition-colors"
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

          {/* Directory Table */}
          <div className="border border-white/10 rounded-2xl overflow-hidden bg-zinc-950/80 shadow-2xl backdrop-blur-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/10 font-bold text-zinc-400">
                  <th className="p-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredInvoices.length && filteredInvoices.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-white/20 bg-zinc-900 text-white focus:ring-0"
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
              <tbody className="divide-y divide-white/5">
                {sortedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-14 text-center text-zinc-500">
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
                        className={`hover:bg-white/[0.03] cursor-pointer transition-colors ${
                          isSelected ? 'bg-white/[0.06]' : ''
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
                          <div className="font-bold font-mono text-white">
                            {inv.invoiceNumber}
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
            await InvoiceService.deleteInvoice(id);
            showToast('Invoice Deleted', 'Invoice has been deleted.', 'info');
            await refreshData();
          } catch (err) {
            showToast('Error', 'Unable to delete invoice.', 'error');
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
