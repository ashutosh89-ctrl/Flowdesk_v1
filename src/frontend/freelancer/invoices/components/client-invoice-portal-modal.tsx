import React, { useState } from 'react';
import { Invoice, UserProfile } from '@/shared/types';
import { formatCurrency, getCurrencySymbol } from '@/shared/utils/currency';
import { generateInvoicePDF, printInvoiceDocument } from '@/shared/utils/invoice-pdf';
import { DueIndicatorBadge, PaymentStatusPill, WorkflowStatusPill } from './status-pills';
import {
  X,
  CreditCard,
  Printer,
  Download,
  Shield,
  FileText,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  Lock,
  Building2,
  ShieldCheck,
  PenTool,
} from 'lucide-react';

interface ClientInvoicePortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onRecordView?: (id: string) => void;
  profile?: UserProfile | null;
}

export function ClientInvoicePortalModal({
  isOpen,
  onClose,
  invoice,
  profile,
}: ClientInvoicePortalModalProps) {
  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    printInvoiceDocument(invoice, profile);
  };

  const studioName = profile?.companyName || profile?.name || 'FlowDesk Freelance Studio';
  const studioEmail = profile?.email || 'billing@flowdesk.app';
  const studioPhone = profile?.phone || '+1 (555) 019-2831';
  const studioAddress = profile?.address || '';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-zinc-950/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-6 backdrop-blur-2xl text-white">
        {/* Top Portal Banner */}
        <div className="flex items-center justify-between px-6 py-3 bg-white/[0.03] border-b border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold tracking-wide uppercase text-[11px] text-zinc-300">
              FlowDesk Client Portal – Secure Invoice Document
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => generateInvoicePDF(invoice, profile)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" /> Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-300" /> Print
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice Document Canvas */}
        <div className="p-8 space-y-8 max-h-[80vh] overflow-y-auto bg-zinc-950/90">
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-white/10">
            <div className="flex items-start gap-4">
              {profile?.logoUrl ? (
                <img
                  src={profile.logoUrl}
                  alt="Studio Logo"
                  className="h-12 w-auto max-w-[130px] object-contain rounded-xl bg-white/5 p-1.5 border border-white/10 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
              )}
              <div>
                <div className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  {studioName}
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  {studioEmail} {studioPhone ? `• ${studioPhone}` : ''}
                  {studioAddress && (
                    <>
                      <br />
                      <span className="text-zinc-500 text-[11px]">{studioAddress}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="text-2xl font-black font-mono tracking-tight text-white">
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
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Billed To</span>
              <div className="text-sm font-bold text-white">{invoice.clientName}</div>
              <div className="text-zinc-400">{invoice.clientEmail}</div>
              {invoice.projectName && (
                <div className="pt-2 text-zinc-300 font-medium">
                  Project: {invoice.projectName}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-400">Issue Date:</span>
                <span className="font-mono font-semibold text-white">{invoice.issueDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Due Date:</span>
                <span className="font-mono font-semibold text-white">{invoice.dueDate}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/10">
                <span className="text-zinc-400">Status:</span>
                <DueIndicatorBadge
                  dueDate={invoice.dueDate}
                  paymentStatus={invoice.paymentStatus}
                  workflowStatus={invoice.workflowStatus}
                />
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950/60">
            <table className="w-full text-left border-collapse text-xs">
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
                    <td className="p-3 text-white font-medium">{it.description}</td>
                    <td className="p-3 text-right text-zinc-300 font-mono">{it.quantity}</td>
                    <td className="p-3 text-right text-zinc-300 font-mono">
                      {formatCurrency(it.rate, invoice.currency)}
                    </td>
                    <td className="p-3 text-right text-white font-mono font-bold">
                      {formatCurrency(it.amount, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end">
            <div className="w-full sm:w-80 p-5 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-2.5 text-xs shadow-xl">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal:</span>
                <span className="font-mono text-white font-semibold">
                  {formatCurrency(invoice.subtotal, invoice.currency)}
                </span>
              </div>
              {invoice.tax > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Tax ({invoice.taxName || 'Tax'} {invoice.taxPercentage}%):</span>
                  <span className="font-mono text-white font-semibold">
                    {formatCurrency(invoice.tax, invoice.currency)}
                  </span>
                </div>
              )}
              {invoice.discount ? (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount:</span>
                  <span className="font-mono font-semibold">
                    -{formatCurrency(invoice.discount, invoice.currency)}
                  </span>
                </div>
              ) : null}
              <div className="pt-2.5 border-t border-white/10 flex justify-between items-center text-sm font-bold text-white">
                <span>Total Amount:</span>
                <span className="font-mono text-base font-extrabold text-amber-400">{formatCurrency(invoice.total, invoice.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Payment Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
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

          {/* Authorized Signature & Signatory Block */}
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

          {/* Action Footer for Client */}
          <div className="p-5 rounded-2xl border border-white/10 bg-zinc-900/90 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                {invoice.paymentStatus === 'paid' ? 'Invoice Paid & Settled' : 'Payment Status & Terms'}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {invoice.paymentStatus === 'paid'
                  ? 'Official receipt has been issued.'
                  : 'Client may settle online or via bank transfer through their secure Client Portal.'}
              </p>
            </div>

            {invoice.paymentStatus !== 'paid' ? (
              <div className="px-4 py-2 rounded-xl bg-zinc-800/80 border border-white/10 text-zinc-300 text-xs font-mono flex items-center gap-2 shadow-inner">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Client Action: Online Settlement
              </div>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Payment Completed
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
