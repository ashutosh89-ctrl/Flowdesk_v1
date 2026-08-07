import React, { useState } from 'react';
import { Invoice } from '../../../types';
import { formatCurrency, getCurrencySymbol } from '../../../utils/currency';
import { DueIndicatorBadge, PaymentStatusPill, WorkflowStatusPill } from './status-pills';
import {
  X,
  CheckCircle2,
  Bell,
  Printer,
  ExternalLink,
  Clock,
  ShieldCheck,
  FileText,
  DollarSign,
  History,
  Receipt,
  User,
  AlertCircle,
} from 'lucide-react';

interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onMarkPaid: (invoice: Invoice) => void;
  onSendReminder: (invoiceId: string) => void;
  onOpenPortalView: (invoice: Invoice) => void;
}

export function InvoiceDetailsModal({
  isOpen,
  onClose,
  invoice,
  onMarkPaid,
  onSendReminder,
  onOpenPortalView,
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
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden my-6">
        {/* Toast Feedback */}
        {reminderToast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs shadow-lg flex items-center gap-2 border border-zinc-700">
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>{reminderToast}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono text-zinc-900 dark:text-zinc-100">
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
            className="p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 self-start sm:self-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {invoice.paymentStatus !== 'paid' && (
              <button
                onClick={() => onMarkPaid(invoice)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid (Offline)
              </button>
            )}

            {invoice.paymentStatus !== 'paid' && invoice.workflowStatus !== 'cancelled' && (
              <button
                onClick={handleTriggerReminder}
                disabled={(invoice.reminders?.length || 0) >= 3}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                Send Reminder ({invoice.reminders?.length || 0}/3)
              </button>
            )}

            <button
              onClick={() => onOpenPortalView(invoice)}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-medium flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
              Client Portal View
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-medium flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-500" /> Print / PDF
            </button>
          </div>

          <div className="text-right text-[11px] font-mono text-zinc-500">
            Total: <strong className="text-zinc-900 dark:text-zinc-100 text-xs">{formatCurrency(invoice.total, invoice.currency)}</strong>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 bg-white dark:bg-zinc-900 text-xs">
          <button
            onClick={() => setActiveTab('items')}
            className={`py-3 px-4 font-medium border-b-2 flex items-center gap-1.5 ${
              activeTab === 'items'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Line Items & Details
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-4 font-medium border-b-2 flex items-center gap-1.5 ${
              activeTab === 'timeline'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Timeline ({invoice.timeline?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('reminders')}
            className={`py-3 px-4 font-medium border-b-2 flex items-center gap-1.5 ${
              activeTab === 'reminders'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" /> Reminders ({invoice.reminders?.length || 0}/3)
          </button>

          {invoice.receipts && invoice.receipts.length > 0 && (
            <button
              onClick={() => setActiveTab('receipts')}
              className={`py-3 px-4 font-medium border-b-2 flex items-center gap-1.5 ${
                activeTab === 'receipts'
                  ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" /> Receipts ({invoice.receipts.length})
            </button>
          )}

          <button
            onClick={() => setActiveTab('activity')}
            className={`py-3 px-4 font-medium border-b-2 flex items-center gap-1.5 ${
              activeTab === 'activity'
                ? 'border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Audit Log ({invoice.activityLog?.length || 0})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto text-xs">
          {activeTab === 'items' && (
            <div className="space-y-6">
              {/* Dates & Currency Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
                <div>
                  <span className="text-zinc-500 block text-[11px]">Issue Date</span>
                  <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{invoice.issueDate}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Due Date</span>
                  <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{invoice.dueDate}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Currency</span>
                  <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{invoice.currency}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[11px]">Last Delivered</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {invoice.lastDeliveredAt || 'Not dispatched'}
                  </span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-500 dark:text-zinc-400">
                      <th className="p-2.5 w-[50%]">Item Description</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">Rate ({getCurrencySymbol(invoice.currency)})</th>
                      <th className="p-2.5 text-right">Amount ({getCurrencySymbol(invoice.currency)})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {invoice.items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="p-2.5 font-medium text-zinc-900 dark:text-zinc-100">{it.description}</td>
                        <td className="p-2.5 text-right font-mono text-zinc-600 dark:text-zinc-400">{it.quantity}</td>
                        <td className="p-2.5 text-right font-mono text-zinc-600 dark:text-zinc-400">
                          {formatCurrency(it.rate, invoice.currency)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(it.amount, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Calculations */}
              <div className="flex justify-end">
                <div className="w-full sm:w-72 p-4 rounded-lg bg-zinc-50/80 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex justify-between text-zinc-500">
                    <span>Subtotal:</span>
                    <span className="font-mono text-zinc-900 dark:text-zinc-100">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                  </div>
                  {invoice.tax > 0 && (
                    <div className="flex justify-between text-zinc-500">
                      <span>Tax ({invoice.taxName || 'Tax'} {invoice.taxPercentage}%):</span>
                      <span className="font-mono text-zinc-900 dark:text-zinc-100">{formatCurrency(invoice.tax, invoice.currency)}</span>
                    </div>
                  )}
                  {invoice.discount ? (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Discount:</span>
                      <span className="font-mono">-{formatCurrency(invoice.discount, invoice.currency)}</span>
                    </div>
                  ) : null}
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-between text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    <span>Total Amount:</span>
                    <span className="font-mono">{formatCurrency(invoice.total, invoice.currency)}</span>
                  </div>
                </div>
              </div>

              {/* Notes Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {invoice.notes && (
                  <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">Client Terms / Notes</span>
                    <p className="text-zinc-600 dark:text-zinc-400">{invoice.notes}</p>
                  </div>
                )}
                {invoice.paymentInstructions && (
                  <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-1">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">Payment Instructions</span>
                    <p className="text-zinc-600 dark:text-zinc-400">{invoice.paymentInstructions}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Payment & Workflow Timeline
              </h3>
              <div className="space-y-3 relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                {invoice.timeline?.map((item) => (
                  <div key={item.id} className="relative pl-4 space-y-0.5">
                    <span className="absolute -left-3.5 top-1 w-2.5 h-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600 border-2 border-white dark:border-zinc-900" />
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.title}</span>
                      <span className="text-[11px] font-mono text-zinc-400">{item.timestamp}</span>
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Actor: <strong className="text-zinc-700 dark:text-zinc-300">{item.actor}</strong>
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
                  <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Manual Reminders Dispatch Log
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Maximum limit: 3 manual reminders per invoice.
                  </p>
                </div>
                <button
                  onClick={handleTriggerReminder}
                  disabled={(invoice.reminders?.length || 0) >= 3}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  <Bell className="w-3.5 h-3.5" /> Dispatch Reminder
                </button>
              </div>

              {!invoice.reminders || invoice.reminders.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 border border-dashed rounded-lg">
                  No reminders sent yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {invoice.reminders.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <span>Reminder #{r.reminderNumber}</span>
                          <span className="px-1.5 py-0.2 text-[10px] rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium">
                            {r.method.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-zinc-500">{r.notes}</p>
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
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Official Payment Receipt
              </h3>
              {invoice.receipts?.map((rcp) => (
                <div
                  key={rcp.id}
                  className="p-5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-900 pb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="font-bold font-mono text-emerald-900 dark:text-emerald-200 text-sm">
                        {rcp.receiptNumber}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
                      Date: {rcp.paymentDate}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-zinc-500 block">Amount Settled</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-base">
                        {formatCurrency(rcp.amount, rcp.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Payment Method</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 uppercase">
                        {rcp.paymentMethod.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {rcp.razorpayOrderId && (
                    <div className="p-2.5 rounded bg-zinc-900 text-zinc-200 font-mono text-[11px] space-y-1">
                      <div>Razorpay Order ID: <span className="text-blue-400">{rcp.razorpayOrderId}</span></div>
                      <div>Payment Token ID: <span className="text-emerald-400">{rcp.razorpayPaymentId}</span></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Audit Log & Field Change History
              </h3>
              {!invoice.activityLog || invoice.activityLog.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 border border-dashed rounded-lg">
                  No audit log available
                </div>
              ) : (
                <div className="space-y-2">
                  {invoice.activityLog.map((act) => (
                    <div
                      key={act.id}
                      className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-start justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-zinc-400" />
                          <span>{act.user}</span>
                          <span className="text-zinc-400">•</span>
                          <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{act.action}</span>
                        </div>
                        {act.details && <p className="text-zinc-500">{act.details}</p>}
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
