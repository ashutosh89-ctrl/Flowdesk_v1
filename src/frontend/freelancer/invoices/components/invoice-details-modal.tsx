import React, { useRef, useState, useEffect } from 'react';
import { Invoice, UserProfile } from '@/shared/types';
import { formatCurrency } from '@/shared/utils/currency';
import {
  exportInvoiceToPDF,
  exportInvoiceToPNG,
  exportInvoiceToJPG,
  printInvoice,
} from '@/shared/utils/invoice-export';
import { InvoiceDocument } from '@/frontend/shared/invoice/invoice-document';
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
  FileText,
  History,
  Receipt,
  User,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  Check,
  Ban,
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
  const [exportingType, setExportingType] = useState<'pdf' | 'png' | 'jpg' | 'print' | null>(null);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(invoice);
  const documentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentInvoice(invoice);
  }, [invoice]);

  if (!isOpen || !currentInvoice) return null;

  const handleConfirmClientPayment = async (status: 'confirmed' | 'rejected') => {
    if (!currentInvoice) return;
    setIsConfirmingPayment(true);
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(currentInvoice.id)}/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          amount: currentInvoice.paymentNotification?.amount || currentInvoice.remainingBalance || currentInvoice.total,
          notes: status === 'confirmed' ? 'Verified by freelancer' : 'Declined by freelancer in FlowDesk',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update payment notification.');
      }
      setReminderToast(status === 'confirmed' ? 'Payment confirmed! Receipt generated and email dispatched.' : 'Payment notification declined.');
      setTimeout(() => setReminderToast(null), 4000);
      if (data.invoice) {
        const updatedInv: Invoice = {
          ...currentInvoice,
          paymentStatus: data.invoice.payment_status || (status === 'confirmed' ? 'paid' : currentInvoice.paymentStatus),
          paymentNotification: data.invoice.payment_notification,
          paidAmount: Number(data.invoice.paid_amount) || currentInvoice.paidAmount,
          remainingBalance: Number(data.invoice.remaining_balance) || (status === 'confirmed' ? 0 : currentInvoice.remainingBalance),
        };
        setCurrentInvoice(updatedInv);
        onMarkPaid(updatedInv);
      }
    } catch (err: any) {
      setReminderToast(err.message || 'Error updating payment.');
      setTimeout(() => setReminderToast(null), 4000);
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  const handleTriggerReminder = () => {
    const currentReminders = currentInvoice.reminders || [];
    if (currentReminders.length >= 3) {
      setReminderToast('Maximum limit of 3 manual reminders reached for this invoice.');
      setTimeout(() => setReminderToast(null), 3000);
      return;
    }

    onSendReminder(currentInvoice.id);
    setReminderToast(`Reminder #${currentReminders.length + 1} dispatched successfully.`);
    setTimeout(() => setReminderToast(null), 3000);
  };

  const handleExportPDF = async () => {
    if (exportingType) return;
    setExportingType('pdf');
    try {
      await exportInvoiceToPDF(currentInvoice, profile, documentRef.current);
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPNG = async () => {
    if (exportingType) return;
    setExportingType('png');
    try {
      await exportInvoiceToPNG(documentRef.current, currentInvoice.invoiceNumber, currentInvoice, profile);
    } finally {
      setExportingType(null);
    }
  };

  const handleExportJPG = async () => {
    if (exportingType) return;
    setExportingType('jpg');
    try {
      await exportInvoiceToJPG(documentRef.current, currentInvoice.invoiceNumber, currentInvoice, profile);
    } finally {
      setExportingType(null);
    }
  };

  const handlePrint = () => {
    if (exportingType) return;
    setExportingType('print');
    try {
      printInvoice(currentInvoice, profile, documentRef.current);
    } finally {
      setExportingType(null);
    }
  };

  const handleDelete = () => {
    if (onDelete && currentInvoice) {
      if (window.confirm(`Delete invoice ${currentInvoice.invoiceNumber}? This cannot be undone.`)) {
        onDelete(currentInvoice.id);
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-2 sm:my-6 backdrop-blur-2xl text-white">
        {/* Toast Feedback */}
        {reminderToast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs shadow-lg flex items-center gap-2 border border-white/10 print-no-display">
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>{reminderToast}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold font-mono text-white">
                {currentInvoice.invoiceNumber}
              </span>
              <WorkflowStatusPill status={currentInvoice.workflowStatus} />
              <PaymentStatusPill status={currentInvoice.paymentStatus} />
              <DueIndicatorBadge
                dueDate={currentInvoice.dueDate}
                paymentStatus={currentInvoice.paymentStatus}
                workflowStatus={currentInvoice.workflowStatus}
              />
            </div>
            <div className="text-xs text-zinc-400 flex items-center gap-2 flex-wrap">
              <span>Client: <strong className="text-zinc-200">{currentInvoice.clientName}</strong></span>
              {currentInvoice.projectName && (
                <>
                  <span>•</span>
                  <span>Project: <strong className="text-zinc-200">{currentInvoice.projectName}</strong></span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close invoice details"
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white self-start sm:self-center print-no-display cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-2.5 text-xs print-no-display">
          <div className="flex flex-wrap items-center gap-2">
            {currentInvoice.paymentStatus !== 'paid' && (
              <button
                onClick={() => onMarkPaid(currentInvoice)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid (Offline)
              </button>
            )}

            {currentInvoice.paymentStatus !== 'paid' && currentInvoice.workflowStatus !== 'cancelled' && (
              <button
                onClick={handleTriggerReminder}
                disabled={(currentInvoice.reminders?.length || 0) >= 3}
                className="px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                Send Reminder ({currentInvoice.reminders?.length || 0}/3)
              </button>
            )}

            <button
              onClick={() => onOpenPortalView(currentInvoice)}
              className="px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#43D6B0]" />
              Portal Preview
            </button>

            {/* Multi-Format Export Buttons */}
            <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

            <button
              onClick={handleExportPDF}
              disabled={!!exportingType}
              aria-label="Download Invoice PDF"
              className="px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {exportingType === 'pdf' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{exportingType === 'pdf' ? 'Preparing PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={handleExportPNG}
              disabled={!!exportingType}
              aria-label="Download Invoice PNG image"
              className="px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {exportingType === 'png' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>{exportingType === 'png' ? 'Generating...' : 'PNG'}</span>
            </button>

            <button
              onClick={handleExportJPG}
              disabled={!!exportingType}
              aria-label="Download Invoice JPG image"
              className="px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {exportingType === 'jpg' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-violet-400" />
              )}
              <span>{exportingType === 'jpg' ? 'Generating...' : 'JPG'}</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={!!exportingType}
              aria-label="Print Invoice"
              className="px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-400" />
              <span>Print</span>
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
            Total: <strong className="text-white text-xs">{formatCurrency(currentInvoice.total, currentInvoice.currency)}</strong>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 px-3.5 sm:px-6 bg-zinc-950/80 text-xs print-no-display overflow-x-auto">
          <button
            onClick={() => setActiveTab('items')}
            className={`py-3 px-4 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'items'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" /> Document Preview & Items
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-4 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Timeline ({currentInvoice.timeline?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('reminders')}
            className={`py-3 px-4 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'reminders'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" /> Reminders ({currentInvoice.reminders?.length || 0}/3)
          </button>

          {currentInvoice.receipts && currentInvoice.receipts.length > 0 && (
            <button
              onClick={() => setActiveTab('receipts')}
              className={`py-3 px-4 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'receipts'
                  ? 'border-amber-400 text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" /> Receipts ({currentInvoice.receipts.length})
            </button>
          )}

          <button
            onClick={() => setActiveTab('activity')}
            className={`py-3 px-4 font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'activity'
                ? 'border-amber-400 text-white'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Audit Log ({currentInvoice.activityLog?.length || 0})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-3.5 sm:p-6 max-h-[75vh] overflow-y-auto text-xs bg-zinc-950/60">
          {activeTab === 'items' && (
            <div className="space-y-4">
              {/* Payment Notification Awaiting Verification Banner */}
              {currentInvoice.paymentNotification && currentInvoice.paymentNotification.status === 'awaiting_verification' && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-semibold text-amber-300 text-xs uppercase tracking-wider">
                        Client Payment Notification Submitted
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300">
                      Client reported payment of <strong className="text-white font-mono">{formatCurrency(currentInvoice.paymentNotification.amount, currentInvoice.currency)}</strong> via{' '}
                      <span className="capitalize font-medium text-amber-200">{currentInvoice.paymentNotification.paymentMethod.replace('_', ' ')}</span>.
                    </p>
                    <p className="text-[11px] font-mono text-zinc-400">
                      UTR / Reference: <span className="text-white font-bold">{currentInvoice.paymentNotification.transactionReference}</span>
                      {currentInvoice.paymentNotification.notes && ` • Note: "${currentInvoice.paymentNotification.notes}"`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isConfirmingPayment}
                      onClick={() => handleConfirmClientPayment('confirmed')}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      {isConfirmingPayment ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Verify & Confirm Receipt</span>
                    </button>
                    <button
                      type="button"
                      disabled={isConfirmingPayment}
                      onClick={() => handleConfirmClientPayment('rejected')}
                      className="px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Verified Confirmation Note */}
              {currentInvoice.paymentNotification && currentInvoice.paymentNotification.status === 'confirmed' && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Payment verified: {formatCurrency(currentInvoice.paymentNotification.amount, currentInvoice.currency)} (Ref: {currentInvoice.paymentNotification.transactionReference}). Confirmed in financial ledger.
                  </span>
                </div>
              )}

              <div className="flex justify-center p-2 rounded-xl bg-zinc-900/50 border border-white/5 overflow-x-auto">
                <InvoiceDocument
                  ref={documentRef}
                  invoice={currentInvoice}
                  branding={profile}
                  responsiveScale={true}
                  documentId={`freelancer-invoice-${currentInvoice.id}`}
                />
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4 p-4 rounded-xl bg-zinc-900/40 border border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Payment & Workflow Timeline
              </h3>
              <div className="space-y-3 relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                {currentInvoice.timeline?.map((item) => (
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
            <div className="space-y-4 p-4 rounded-xl bg-zinc-900/40 border border-white/5">
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
                  disabled={(currentInvoice.reminders?.length || 0) >= 3}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" /> Record Reminder
                </button>
              </div>

              {!currentInvoice.reminders || currentInvoice.reminders.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 border border-dashed border-white/10 rounded-xl">
                  No reminders recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {currentInvoice.reminders.map((r) => (
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
            <div className="space-y-4 p-4 rounded-xl bg-zinc-900/40 border border-white/5">
              <h3 className="text-xs font-bold text-white">
                Settlement & Payment Receipts
              </h3>
              {currentInvoice.receipts && currentInvoice.receipts.length > 0 ? (
                currentInvoice.receipts.map((rcp) => (
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
                          {formatCurrency(rcp.amount, currentInvoice.currency)}
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
            <div className="space-y-4 p-4 rounded-xl bg-zinc-900/40 border border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Audit Log & Field Change History
              </h3>
              {!currentInvoice.activityLog || currentInvoice.activityLog.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 border border-dashed border-white/10 rounded-xl">
                  No audit log available
                </div>
              ) : (
                <div className="space-y-2">
                  {currentInvoice.activityLog.map((act) => (
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
