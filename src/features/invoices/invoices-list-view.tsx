import React, { useState, useEffect } from 'react';
import { Invoice, FinancialDashboardMetrics } from '../../types';
import { InvoiceService } from '../../services';
import { FlowDeskStore } from '../../services/storage-store';
import { formatCurrency } from '../../utils/currency';
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
  Trash2,
  ExternalLink,
  Bell,
  BarChart3,
  ListFilter,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '../../components/ui/toast';

export const InvoicesListView: React.FC = () => {
  const [viewMode, setViewMode] = useState<'dashboard' | 'directory'>('dashboard');
  const [invoices, setInvoices] = useState<Invoice[]>(() => FlowDeskStore.getInvoices());
  const [metrics, setMetrics] = useState<FinancialDashboardMetrics>(() => FlowDeskStore.getFinancialMetrics());

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

  const { showToast } = useToast();

  const refreshData = () => {
    const updatedInvoices = FlowDeskStore.getInvoices();
    const updatedMetrics = FlowDeskStore.getFinancialMetrics();
    setInvoices(updatedInvoices);
    setMetrics(updatedMetrics);

    // Keep active selected invoice up to date
    if (detailsInvoice) {
      const refreshedDetails = FlowDeskStore.getInvoiceById(detailsInvoice.id);
      if (refreshedDetails) setDetailsInvoice(refreshedDetails);
    }
  };

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

  const handleSaveInvoice = (payload: any) => {
    if (invoiceToEdit) {
      InvoiceService.updateInvoice(invoiceToEdit.id, payload).then(() => {
        showToast('Invoice Updated', `Invoice ${payload.invoiceNumber} saved successfully.`, 'success');
        refreshData();
      });
    } else {
      InvoiceService.createInvoice(payload).then(() => {
        showToast('Invoice Created', `Invoice ${payload.invoiceNumber} created and recorded.`, 'success');
        refreshData();
      });
    }
  };

  const handleConfirmPaidOffline = (id: string, paymentMethod: string, notes?: string) => {
    InvoiceService.markInvoicePaidOffline(id, paymentMethod, notes).then(() => {
      showToast('Settlement Recorded', 'Invoice marked as paid and receipt generated.', 'success');
      refreshData();
    });
  };

  const handleSendReminder = (id: string) => {
    InvoiceService.sendReminder(id).then((res) => {
      if (res.success) {
        showToast('Reminder Dispatched', res.message, 'success');
      } else {
        showToast('Reminder Limit', res.message, 'info');
      }
      refreshData();
    });
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

  const handleBulkMarkPaid = () => {
    selectedIds.forEach((id) => {
      InvoiceService.markInvoicePaidOffline(id, 'bank_transfer', 'Bulk offline settlement');
    });
    showToast('Bulk Action Complete', `${selectedIds.length} invoice(s) marked as paid.`, 'success');
    setSelectedIds([]);
    refreshData();
  };

  const handleBulkDelete = () => {
    selectedIds.forEach((id) => {
      InvoiceService.deleteInvoice(id);
    });
    showToast('Invoices Deleted', `${selectedIds.length} invoice(s) deleted.`, 'info');
    setSelectedIds([]);
    refreshData();
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
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            Invoice & Financial Workspace
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            FlowDesk Financial Engine • Lightweight, modern settlements for freelancers
          </p>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-xs">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-3 py-1.5 font-medium rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'dashboard'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button
              onClick={() => setViewMode('directory')}
              className={`px-3 py-1.5 font-medium rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'directory'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" /> All Invoices ({invoices.length})
            </button>
          </div>

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> Create Invoice
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'dashboard' ? (
        <InvoiceDashboard
          metrics={metrics}
          onSelectInvoice={handleOpenDetails}
          onCreateInvoice={handleOpenCreate}
        />
      ) : (
        <div className="space-y-4">
          {/* Controls Bar: Search, Filters, Sort */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search invoice #, client, or project..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>

              {/* Filter Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Workflow Status Filter */}
                <select
                  value={workflowFilter}
                  onChange={(e) => setWorkflowFilter(e.target.value)}
                  className="px-2.5 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none"
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
                  className="px-2.5 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                >
                  <option value="all">Payment: All</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>

                {/* Currency Filter */}
                <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value)}
                  className="px-2.5 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none"
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
                  className="px-2.5 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none"
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
              <div className="p-2.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-950 flex items-center justify-between text-xs animate-in fade-in">
                <span className="font-medium font-mono pl-2">
                  {selectedIds.length} invoice(s) selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBulkMarkPaid}
                    className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Directory Table */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900/80 shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/80 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-500 dark:text-zinc-400">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredInvoices.length && filteredInvoices.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0"
                    />
                  </th>
                  <th className="p-3.5">Invoice # & Client</th>
                  <th className="p-3.5">Project</th>
                  <th className="p-3.5">Issue / Due Date</th>
                  <th className="p-3.5">Workflow</th>
                  <th className="p-3.5">Payment</th>
                  <th className="p-3.5 text-right">Total Amount</th>
                  <th className="p-3.5 text-center">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {sortedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-zinc-500">
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
                        className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors ${
                          isSelected ? 'bg-zinc-50/80 dark:bg-zinc-800/30' : ''
                        }`}
                      >
                        <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleToggleSelect(inv.id, e as any)}
                            className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0"
                          />
                        </td>

                        <td className="p-3.5">
                          <div className="font-semibold font-mono text-zinc-900 dark:text-zinc-100">
                            {inv.invoiceNumber}
                          </div>
                          <div className="text-zinc-500 dark:text-zinc-400 font-medium">
                            {inv.clientName}
                          </div>
                        </td>

                        <td className="p-3.5 text-zinc-600 dark:text-zinc-300 max-w-[180px] truncate">
                          {inv.projectName || <span className="text-zinc-400 italic">No Project</span>}
                        </td>

                        <td className="p-3.5 space-y-1">
                          <div className="font-mono text-zinc-600 dark:text-zinc-400">{inv.issueDate}</div>
                          <DueIndicatorBadge
                            dueDate={inv.dueDate}
                            paymentStatus={inv.paymentStatus}
                            workflowStatus={inv.workflowStatus}
                          />
                        </td>

                        <td className="p-3.5">
                          <WorkflowStatusPill status={inv.workflowStatus} />
                        </td>

                        <td className="p-3.5">
                          <PaymentStatusPill status={inv.paymentStatus} />
                        </td>

                        <td className="p-3.5 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(inv.total, inv.currency)}
                        </td>

                        <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {inv.paymentStatus !== 'paid' && (
                              <button
                                onClick={(e) => handleOpenMarkPaid(inv, e)}
                                title="Mark Paid (Offline)"
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 dark:text-emerald-300"
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
                                className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:hover:bg-amber-900 dark:text-amber-300"
                              >
                                <Bell className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={(e) => handleOpenPortal(inv, e)}
                              title="Client Portal View"
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:hover:bg-blue-900 dark:text-blue-300"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleOpenEdit(inv, e)}
                              title="Edit Invoice"
                              className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300"
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
      )}

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
        onMarkPaid={(inv) => {
          setIsDetailsOpen(false);
          handleOpenMarkPaid(inv);
        }}
        onSendReminder={handleSendReminder}
        onOpenPortalView={(inv) => {
          setIsDetailsOpen(false);
          handleOpenPortal(inv);
        }}
      />

      {/* Mark Paid Modal */}
      <MarkPaidModal
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
      />
    </div>
  );
};
