import React, { useState } from 'react';
import { Invoice } from '../../../types';
import { formatCurrency, getCurrencySymbol } from '../../../utils/currency';
import { DueIndicatorBadge, PaymentStatusPill, WorkflowStatusPill } from './status-pills';
import {
  X,
  CreditCard,
  Printer,
  Shield,
  FileText,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  Lock,
} from 'lucide-react';

interface ClientInvoicePortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onRecordView?: (id: string) => void;
}

export function ClientInvoicePortalModal({
  isOpen,
  onClose,
  invoice,
}: ClientInvoicePortalModalProps) {
  const [showRazorpayDemo, setShowRazorpayDemo] = useState(false);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden my-6">
        {/* Top Portal Banner */}
        <div className="flex items-center justify-between px-6 py-3 bg-zinc-900 text-zinc-100 dark:bg-zinc-950 border-b border-zinc-800 text-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold tracking-wide uppercase text-[11px] text-zinc-300">
              FlowDesk Client Portal – Secure Invoice Document
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice Document Canvas */}
        <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto bg-white dark:bg-zinc-900">
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <div className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                FlowDesk Freelance Studio
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Alex Rivera Design Architecture Ltd.
                <br />
                billing@flowdesk.app • +1 (555) 019-2831
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="text-2xl font-black font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
                {invoice.invoiceNumber}
              </div>
              <div className="flex items-center sm:justify-end gap-2 pt-1">
                <WorkflowStatusPill status={invoice.workflowStatus} />
                <PaymentStatusPill status={invoice.paymentStatus} />
              </div>
            </div>
          </div>

          {/* Client & Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Billed To</span>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{invoice.clientName}</div>
              <div className="text-zinc-500">{invoice.clientEmail}</div>
              {invoice.projectName && (
                <div className="pt-2 text-zinc-600 dark:text-zinc-300 font-medium">
                  Project: {invoice.projectName}
                </div>
              )}
            </div>

            <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">Issue Date:</span>
                <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{invoice.issueDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Due Date:</span>
                <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{invoice.dueDate}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                <span className="text-zinc-500">Status:</span>
                <DueIndicatorBadge
                  dueDate={invoice.dueDate}
                  paymentStatus={invoice.paymentStatus}
                  workflowStatus={invoice.workflowStatus}
                />
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-500 dark:text-zinc-400">
                  <th className="p-3 w-[50%]">Item Description</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Rate ({getCurrencySymbol(invoice.currency)})</th>
                  <th className="p-3 text-right">Amount ({getCurrencySymbol(invoice.currency)})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {invoice.items.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="p-3 text-zinc-900 dark:text-zinc-100 font-medium">{it.description}</td>
                    <td className="p-3 text-right text-zinc-600 dark:text-zinc-400 font-mono">{it.quantity}</td>
                    <td className="p-3 text-right text-zinc-600 dark:text-zinc-400 font-mono">
                      {formatCurrency(it.rate, invoice.currency)}
                    </td>
                    <td className="p-3 text-right text-zinc-900 dark:text-zinc-100 font-mono font-medium">
                      {formatCurrency(it.amount, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal:</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-100 font-medium">
                  {formatCurrency(invoice.subtotal, invoice.currency)}
                </span>
              </div>
              {invoice.tax > 0 && (
                <div className="flex justify-between text-zinc-500">
                  <span>Tax ({invoice.taxName || 'Tax'}):</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100 font-medium">
                    {formatCurrency(invoice.tax, invoice.currency)}
                  </span>
                </div>
              )}
              {invoice.discount ? (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount:</span>
                  <span className="font-mono font-medium">
                    -{formatCurrency(invoice.discount, invoice.currency)}
                  </span>
                </div>
              ) : null}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-between text-sm font-bold text-zinc-900 dark:text-zinc-100">
                <span>Total Amount:</span>
                <span className="font-mono">{formatCurrency(invoice.total, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Payment Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {invoice.notes && (
              <div className="p-3.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-1">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Client Terms / Notes</span>
                <p className="text-zinc-600 dark:text-zinc-400">{invoice.notes}</p>
              </div>
            )}

            {invoice.paymentInstructions && (
              <div className="p-3.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-1">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Payment Instructions</span>
                <p className="text-zinc-600 dark:text-zinc-400">{invoice.paymentInstructions}</p>
              </div>
            )}
          </div>

          {/* Action Footer for Client */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-900 text-white dark:bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-emerald-400" />
                {invoice.paymentStatus === 'paid' ? 'Invoice Paid & Settled' : 'Pay Online via Razorpay'}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {invoice.paymentStatus === 'paid'
                  ? 'Thank you! Official receipt has been issued.'
                  : 'Instant credit card, UPI, bank wire or netbanking settlement.'}
              </p>
            </div>

            {invoice.paymentStatus !== 'paid' ? (
              <button
                onClick={() => setShowRazorpayDemo(true)}
                className="w-full sm:w-auto px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <CreditCard className="w-4 h-4" />
                Pay {formatCurrency(invoice.total, invoice.currency)} Now
              </button>
            ) : (
              <div className="px-4 py-1.5 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Payment Completed
              </div>
            )}
          </div>
        </div>

        {/* Razorpay Demo Placeholder Dialog */}
        {showRazorpayDemo && (
          <div className="absolute inset-0 z-10 bg-zinc-950/80 backdrop-blur-xs flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 mx-auto flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Razorpay Checkout Architecture
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                As per Phase 9 specification constraints: Real Razorpay SDK integration, webhooks, and live gateway API calls are prepared in production architecture and disabled in this environment.
              </p>
              <div className="p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-600 dark:text-zinc-300 text-left space-y-1">
                <div>Razorpay Order ID: <span className="text-blue-500">order_demo_9841203</span></div>
                <div>Amount: <span className="text-emerald-500">{formatCurrency(invoice.total, invoice.currency)}</span></div>
                <div>Status: <span className="text-amber-500">Ready for Live Key Provisioning</span></div>
              </div>
              <button
                onClick={() => setShowRazorpayDemo(false)}
                className="w-full py-2 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium text-xs"
              >
                Close Gateway Preview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
