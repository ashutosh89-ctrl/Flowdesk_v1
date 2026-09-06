import React, { useState } from 'react';
import { Invoice, UserProfile } from '@/shared/types';
import { formatCurrency, getCurrencySymbol } from '@/shared/utils/currency';
import { generateInvoicePDF, printInvoiceDocument } from '@/shared/utils/invoice-pdf';
import { DueIndicatorBadge, PaymentStatusPill, WorkflowStatusPill } from './status-pills';
import {
  X,
  CheckCircle2,
  Bell,
  Printer,
  Download,
  ExternalLink,
  Trash2,
  Clock,
  ShieldCheck,
  FileText,
  DollarSign,
  History,
  Receipt,
  User,
  AlertCircle,
  Building2,
  PenTool,
} from 'lucide-react';

interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onMarkPaid: (invoice: Invoice) => void;
  onSendReminder: (invoiceId: string) => void;
  onOpenPortalView: (invoice: Invoice) => void;
  onDelete?: (invoiceId: string) => void;
  profile?: UserProfile | null;
}

export function InvoiceDetailsModal({
  isOpen,
  onClose,
  invoice,
  onMarkPaid,
  onSendReminder,
  onOpenPortalView,
  onDelete,
  profile,
}: InvoiceDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'items' | 'timeline' | 'reminders' | 'receipts' | 'activity'>('items');
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  if (!isOpen || !invoice) return null;

  const handleTriggerReminder = () => {
    const currentReminders = invoice.reminders || [];
    if (currentReminders.length >= 3) {
      setReminderToast('Maximum limit of 3 manual reminders reached for this invoice.');
      setTimeout(() => setReminderToast(null), 3000);
      return;
    }

    onSendReminder(invoice.id);
    setReminderToast(`Reminder #${currentReminders.length + 1} dispatched successfully.`);
    setTimeout(() => setReminderToast(null), 3000);
  };

  const handlePrint = () => {
    printInvoiceDocument(invoice, profile);
  };

  const handleDelete = () => {
    if (onDelete && invoice) {
      if (window.confirm(`Delete invoice ${invoice.invoiceNumber}? This cannot be undone.`)) {
        onDelete(invoice.id);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-zinc-950/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-6 print-invoice backdrop-blur-2xl text-white">
        {/* Toast Feedback */}
        {reminderToast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs shadow-lg flex items-center gap-2 border border-white/10 print-no-display">
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>{reminderToast}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono text-white">
                {invoice.invoiceNumber}
              </span>
              <WorkflowStatusPill status={invoice.workflowStatus} />
              <PaymentStatusPill status={invoice.paymentStatus} />
              <DueIndicatorBadge
                dueDate={invoice.dueDate}
                paymentStatus={invoice.paymentStatus}
                workflowStatus={invoice.workflowStatus}
              />
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <span>Client: <strong className="text-zinc-800 dark:text-zinc-200">{invoice.clientName}</strong></span>
              {invoice.projectName && (
                <>
                  <span>•</span>
                  <span>Project: <strong className="text-zinc-800 dark:text-zinc-200">{invoice.projectName}</strong></span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 self-start sm:self-center print-no-display"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-3 border-b border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-3 text-xs print-no-display">
          <div className="flex flex-wrap items-center gap-2">
            {invoice.paymentStatus !== 'paid' && (
              <button
                onClick={() => onMarkPaid(invoice)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid (Offline)
              </button>
            )}

            {invoice.paymentStatus !== 'paid' && invoice.workflowStatus !== 'cancelled' && (
              <button
                onClick={handleTriggerReminder}
                disabled={(invoice.reminders?.length || 0) >= 3}
                className="px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                Send Reminder ({invoice.reminders?.length || 0}/3)
              </button>
            )}

            <button
              onClick={() => onOpenPortalView(invoice)}
              className="px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              Client Portal View
            </button>

            <button
              onClick={() => generateInvoicePDF(invoice, profile)}
              className="px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" /> Download PDF
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-400" /> Print
            </button>

            {onDelete && (
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>

          <div className="text-right text-[11px] font-mono text-zinc-400">
            Total: <strong className="text-white text-xs">{formatCurrency(invoice.total, invoice.currency)}</strong>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 px-6 bg-zinc-950/80 text-xs print-no-display">
          <button
            onClick={() => setActiveTab('items')}
            className={`py-3 px-4 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'items'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" /> Line Items & Details
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-4 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'timeline'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Timeline ({invoice.timeline?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('reminders')}
            className={`py-3 px-4 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'reminders'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" /> Reminders ({invoice.reminders?.length || 0}/3)
          </button>

          {invoice.receipts && invoice.receipts.length > 0 && (
            <button
              onClick={() => setActiveTab('receipts')}
              className={`py-3 px-4 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'receipts'
                  ? 'border-amber-400 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" /> Receipts ({invoice.receipts.length})
            </button>
          )}

          <button
            onClick={() => setActiveTab('activity')}
            className={`py-3 px-4 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'activity'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Audit Log ({invoice.activityLog?.length || 0})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto text-xs print-invoice-content">
          {activeTab === 'items' && (
            <div className="space-y-6">
              {/* Studio Branding & Metadata Header Preview */}
              <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {profile?.logoUrl ? (
                    <img
                      src={profile.logoUrl}
                      alt="Studio Logo"
                      className="h-10 w-auto max-w-[120px] object-contain rounded-lg bg-white/5 p-1 border border-white/10"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <Building2 className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {profile?.companyName || profile?.name || 'FlowDesk Freelance Studio'}
                    </h4>
                    <p className="text-[11px] text-zinc-400">
                      {profile?.email || 'studio@flowdesk.app'} {profile?.phone ? `• ${profile.phone}` : ''}
                    </p>
                    {profile?.address && (
                      <p className="text-[10px] text-zinc-500 truncate max-w-sm">{profile.address}</p>
                    )}
                  </div>
                </div>

                <div className="sm:text-right text-[11px] text-zinc-400 font-mono">
                  <span className="text-xs font-bold text-amber-400 block">{invoice.invoiceNumber}</span>
                  <span>Currency: <strong className="text-zinc-200">{invoice.currency}</strong></span>
                </div>
              </div>

              {/* Dates & Currency Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-white/10 bg-zinc-900/60">
                <div>
                  <span className="text-zinc-400 block text-[11px]">Issue Date</span>
                  <span className="font-mono font-semibold text-white">{invoice.issueDate}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[11px]">Due Date</span>
                  <span className="font-mono font-semibold text-white">{invoice.dueDate}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[11px]">Payment Status</span>
                  <span className="font-mono font-semibold text-white capitalize">{invoice.paymentStatus}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[11px]">Last Delivered</span>
                  <span className="font-mono text-zinc-300">
                    {invoice.lastDeliveredAt || 'Not dispatched'}
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950/60">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.04] border-b border-white/10 font-semibold text-zinc-400 text-[11px]">
                      <th className="p-3 w-[50%]">Item Description</th>
                      <th className="p-3 text-right">Qty</th>
                      <th className="p-3 text-right">Rate ({getCurrencySymbol(invoice.currency)})</th>
                      <th className="p-3 text-right">Amount ({getCurrencySymbol(invoice.currency)})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoice.items.map((it, idx) => (
                      <tr key={it.id || idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3 font-medium text-white">{it.description}</td>
                        <td className="p-3 text-right font-mono text-zinc-300">{it.quantity}</td>
                        <td className="p-3 text-right font-mono text-zinc-300">
                          {formatCurrency(it.rate, invoice.currency)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-white">
                          {formatCurrency(it.amount, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Calculations */}
              <div className="flex justify-end">
                <div className="w-full sm:w-80 p-5 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-2.5 print-invoice-totals shadow-xl">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal:</span>
                    <span className="font-mono font-semibold text-white">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                  </div>
                  {invoice.tax > 0 && (
                    <div className="flex justify-between text-zinc-400">
                      <span>Tax ({invoice.taxName || 'Tax'} {invoice.taxPercentage}%):</span>
                      <span className="font-mono font-semibold text-white">{formatCurrency(invoice.tax, invoice.currency)}</span>
                    </div>
                  )}
                  {invoice.discount ? (
                    <div className="flex justify-between text-emerald-400">
                      <span>Discount:</span>
                      <span className="font-mono font-semibold text-emerald-400">-{formatCurrency(invoice.discount, invoice.currency)}</span>
                    </div>
                  ) : null}
                  <div className="pt-2.5 border-t border-white/10 flex justify-between text-sm font-bold text-white">
                    <span>Total Amount:</span>
                    <span className="font-mono text-base font-extrabold text-amber-400">{formatCurrency(invoice.total, invoice.currency)}</span>
                  </div>
                  {(invoice.paidAmount || 0) > 0 && (
                    <div className="flex justify-between text-xs text-emerald-400 font-mono">
                      <span>Amount Paid:</span>
                      <span>-{formatCurrency(invoice.paidAmount || 0, invoice.currency)}</span>
                    </div>
                  )}
                  {(invoice.remainingBalance ?? (invoice.total - (invoice.paidAmount || 0))) > 0 && (invoice.paidAmount || 0) > 0 && (
                    <div className="pt-1.5 border-t border-white/10 flex justify-between text-xs font-bold text-amber-400 font-mono">
                      <span>Remaining Balance:</span>
                      <span>{formatCurrency(invoice.remainingBalance ?? (invoice.total - (invoice.paidAmount || 0)), invoice.currency)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes & Instructions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {invoice.notes && (
                  <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 space-y-1">
                    <span className="font-bold text-zinc-300">Client Terms / Notes</span>
                    <p className="text-zinc-400">{invoice.notes}</p>
                  </div>
                )}
                {invoice.paymentInstructions && (
                  <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/60 space-y-1">
                    <span className="font-bold text-zinc-300">Payment Instructions</span>
                    <p className="text-zinc-400">{invoice.paymentInstructions}</p>
                  </div>
                )}
              </div>

              {/* Signature & Signatory Preview */}
              <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Authorized Signatory
                  </span>
                  {profile?.signatureUrl ? (
                    <div className="p-2 bg-white/5 rounded-lg border border-white/10 inline-block">
                      <img
                        src={profile.signatureUrl}
                        alt="Authorized Signature"
                        className="h-10 w-auto max-w-[140px] object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-zinc-500 italic text-xs py-1">
                      <PenTool className="w-3.5 h-3.5" />
                      <span>{profile?.name || 'Studio Administrator'}</span>
                    </div>
                  )}
                  <p className="text-xs font-semibold text-white mt-1">
                    {profile?.name || 'Alex Rivera'}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {profile?.role || 'Principal Designer & Developer'} • FlowDesk Certified
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Digitally Verified Document</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Payment & Workflow Timeline
              </h3>
              <div className="space-y-3 relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                {invoice.timeline?.map((item) => (
                  <div key={item.id} className="relative pl-4 space-y-0.5">
                    <span className="absolute -left-3.5 top-1 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-zinc-950" />
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{item.title}</span>
                      <span className="text-[11px] font-mono text-zinc-400">{item.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Actor: <strong className="text-zinc-200">{item.actor}</strong>
                      {item.metadata && ` • ${item.metadata}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reminders' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white">
                    Payment Reminder Log
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Track logged payment reminders for invoice statement.
                  </p>
                </div>
                <button
                  onClick={handleTriggerReminder}
                  disabled={(invoice.reminders?.length || 0) >= 3}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" /> Record Reminder
                </button>
              </div>

              {!invoice.reminders || invoice.reminders.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 border border-dashed border-white/10 rounded-xl">
                  No reminders recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {invoice.reminders.map((r) => (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-xl border border-white/10 bg-zinc-900/60 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>Reminder #{r.reminderNumber}</span>
                          <span className="px-2 py-0.5 text-[10px] rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                            {r.method.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-zinc-400">{r.notes}</p>
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400">{r.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'receipts' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-white">
                Settlement & Payment Receipts
              </h3>
              {invoice.receipts && invoice.receipts.length > 0 ? (
                invoice.receipts.map((rcp) => (
                  <div
                    key={rcp.id}
                    className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span className="font-bold font-mono text-emerald-300 text-sm">
                          {rcp.receiptNumber || `RCP-${rcp.id.slice(0, 8)}`}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-emerald-400">
                        Date: {rcp.paymentDate || 'Recent'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-zinc-400 block">Amount Settled</span>
                        <span className="font-mono font-bold text-emerald-300 text-base">
                          {formatCurrency(rcp.amount, invoice.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block">Payment Method</span>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="font-semibold text-white uppercase">
                            {(rcp.paymentMethod || 'bank_transfer').replace(/_/g, ' ')}
                          </span>
                          {rcp.gateway === 'razorpay' && (
                            <span className="px-1.5 py-0.5 text-[9px] rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                              ONLINE GATEWAY
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {rcp.razorpayPaymentId && (
                      <div className="p-2 rounded-lg bg-black/40 border border-white/5 font-mono text-[10px] text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span>Payment ID: <strong className="text-zinc-200">{rcp.razorpayPaymentId}</strong></span>
                        {rcp.razorpayOrderId && (
                          <span>Order: <strong className="text-zinc-300">{rcp.razorpayOrderId}</strong></span>
                        )}
                      </div>
                    )}

                    {rcp.notes && (
                      <div className="text-[11px] text-zinc-400">
                        Notes: <span className="text-zinc-200">{rcp.notes}</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-zinc-500 border border-dashed border-white/10 rounded-xl">
                  No payment receipts recorded for this invoice yet.
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Audit Log & Field Change History
              </h3>
              {!invoice.activityLog || invoice.activityLog.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 border border-dashed border-white/10 rounded-xl">
                  No audit log available
                </div>
              ) : (
                <div className="space-y-2">
                  {invoice.activityLog.map((act) => (
                    <div
                      key={act.id}
                      className="p-3.5 rounded-xl border border-white/10 bg-zinc-900/60 flex items-start justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="font-medium text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-amber-400" />
                          <span>{act.user}</span>
                          <span className="text-zinc-400">•</span>
                          <span className="text-zinc-300 font-semibold">{act.action}</span>
                        </div>
                        {act.details && <p className="text-zinc-400">{act.details}</p>}
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400">{act.timestamp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
