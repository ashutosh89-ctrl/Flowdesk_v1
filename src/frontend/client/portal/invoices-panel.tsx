'use client';

import React, { useRef, useState } from 'react';
import { Card } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { Modal } from '@/frontend/shared/ui/modal';
import { Invoice, UserProfile, InvoiceBranding, ClientPaymentNotification } from '@/shared/types';
import { formatCurrency } from '@/shared/utils/currency';
import { InvoiceDocument } from '@/frontend/shared/invoice/invoice-document';
import {
  exportInvoiceToPDF,
  exportInvoiceToPNG,
  exportInvoiceToJPG,
  printInvoice,
} from '@/shared/utils/invoice-export';
import {
  Download,
  Eye,
  CheckCircle2,
  Landmark,
  FileText,
  CreditCard,
  Printer,
  Image as ImageIcon,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { isApprovedRazorpayUrl } from '@/shared/utils/safe-url';
import { QRCode } from '@/frontend/shared/ui/qr-code';

interface InvoicesPanelProps {
  invoices: Invoice[];
  onPayClick: (invoice: Invoice) => void;
  onDownloadClick: (invoice: Invoice) => void;
  profile?: UserProfile | null;
  branding?: InvoiceBranding | null;
}

export const InvoicesPanel: React.FC<InvoicesPanelProps> = ({
  invoices,
  onPayClick,
  onDownloadClick,
  profile,
  branding,
}) => {
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [selectedInvoiceModal, setSelectedInvoiceModal] = useState<Invoice | null>(null);
  const [paymentInstructionsModal, setPaymentInstructionsModal] = useState<Invoice | null>(null);
  const [notifyModalInvoice, setNotifyModalInvoice] = useState<Invoice | null>(null);
  const [exportingType, setExportingType] = useState<'pdf' | 'png' | 'jpg' | 'print' | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Payment notification form state
  const [notifyMethod, setNotifyMethod] = useState<'bank_transfer' | 'upi' | 'razorpay' | 'other'>('bank_transfer');
  const [notifyRef, setNotifyRef] = useState('');
  const [notifyAmount, setNotifyAmount] = useState('');
  const [notifyNotes, setNotifyNotes] = useState('');
  const [isSubmittingNotify, setIsSubmittingNotify] = useState(false);
  const [notifySuccessMsg, setNotifySuccessMsg] = useState<string | null>(null);
  const [notifyErrorMsg, setNotifyErrorMsg] = useState<string | null>(null);

  const previewDocRef = useRef<HTMLDivElement>(null);

  const effectiveBranding = branding || (profile as any);

  const copyText = (text: string, fieldId: string) => {
    try {
      navigator.clipboard?.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const handleOpenNotifyModal = (inv: Invoice) => {
    setNotifyModalInvoice(inv);
    setNotifyAmount(String(inv.remainingBalance ?? inv.total));
    setNotifyRef('');
    setNotifyNotes('');
    setNotifyMethod(inv.upiId ? 'upi' : 'bank_transfer');
    setNotifySuccessMsg(null);
    setNotifyErrorMsg(null);
  };

  const handleSubmitPaymentNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyModalInvoice) return;
    if (!notifyRef.trim()) {
      setNotifyErrorMsg('Transaction reference or UTR number is required.');
      return;
    }
    const numAmt = Number(notifyAmount);
    if (isNaN(numAmt) || numAmt <= 0) {
      setNotifyErrorMsg('Please enter a valid positive payment amount.');
      return;
    }

    setIsSubmittingNotify(true);
    setNotifyErrorMsg(null);

    try {
      const res = await fetch(`/api/invoices/${notifyModalInvoice.id}/notify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmt,
          paymentMethod: notifyMethod,
          transactionReference: notifyRef.trim(),
          notes: notifyNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit payment notification');
      }

      setNotifySuccessMsg('Payment notification submitted! The freelancer has been notified to verify and confirm receipt.');
      // Update local invoice state immutably
      const updatedNotification: ClientPaymentNotification = {
        amount: numAmt,
        paymentMethod: notifyMethod,
        transactionReference: notifyRef.trim(),
        notes: notifyNotes.trim() || undefined,
        notifiedAt: new Date().toISOString(),
        status: 'awaiting_verification',
      };
      setNotifyModalInvoice((prev) => (prev ? { ...prev, paymentNotification: updatedNotification } : null));
      if (selectedInvoiceModal && selectedInvoiceModal.id === notifyModalInvoice.id) {
        setSelectedInvoiceModal({ ...selectedInvoiceModal, paymentNotification: updatedNotification });
      }
      setTimeout(() => {
        setNotifyModalInvoice(null);
        setNotifySuccessMsg(null);
      }, 3000);
    } catch (err: any) {
      setNotifyErrorMsg(err.message || 'An error occurred submitting payment notification.');
    } finally {
      setIsSubmittingNotify(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (filter === 'unpaid') return inv.paymentStatus !== 'paid';
    if (filter === 'paid') return inv.paymentStatus === 'paid';
    return true;
  });

  const totalOutstanding = invoices
    .filter((i) => i.paymentStatus !== 'paid')
    .reduce((sum, i) => sum + (i.remainingBalance ?? i.total), 0);

  const handleExportPDF = async (inv: Invoice) => {
    if (exportingType) return;
    setExportingType('pdf');
    try {
      await exportInvoiceToPDF(inv, effectiveBranding, previewDocRef.current);
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPNG = async (inv: Invoice) => {
    if (exportingType) return;
    setExportingType('png');
    try {
      await exportInvoiceToPNG(previewDocRef.current, inv.invoiceNumber, inv, effectiveBranding);
    } finally {
      setExportingType(null);
    }
  };

  const handleExportJPG = async (inv: Invoice) => {
    if (exportingType) return;
    setExportingType('jpg');
    try {
      await exportInvoiceToJPG(previewDocRef.current, inv.invoiceNumber, inv, effectiveBranding);
    } finally {
      setExportingType(null);
    }
  };

  const handlePrint = (inv: Invoice) => {
    if (exportingType) return;
    setExportingType('print');
    try {
      printInvoice(inv, effectiveBranding, previewDocRef.current);
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Financial Summary Card */}
      <Card variant="crystal" className="p-6 border-white/20 bg-gradient-to-r from-zinc-900/90 via-zinc-950 to-zinc-900/90">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider">
              BILLING STATEMENT SUMMARY
            </span>
            <h2 className="text-2xl font-extrabold text-white font-mono mt-1">
              {formatCurrency(totalOutstanding, invoices[0]?.currency || 'USD')}
            </h2>
            <p className="text-xs text-zinc-300 mt-0.5">
              {totalOutstanding > 0 ? 'Outstanding balance awaiting settlement' : 'All statements settled'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All Invoices' },
              { id: 'unpaid', label: 'Unpaid' },
              { id: 'paid', label: 'Paid' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  filter === t.id
                    ? 'bg-white text-zinc-950 font-bold shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Invoices List */}
      <div className="space-y-4">
        {filteredInvoices.length === 0 ? (
          <Card variant="crystal" className="p-12 text-center space-y-3">
            <FileText className="w-10 h-10 text-zinc-600 mx-auto" />
            <h3 className="text-base font-bold text-white">No Invoices Found</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              There are no statements matching your selected view.
            </p>
          </Card>
        ) : (
          filteredInvoices.map((inv) => {
            const isPaid = inv.paymentStatus === 'paid' || inv.status === 'paid';

            return (
              <Card key={inv.id} variant="crystal" className="p-5 border-white/15 hover:border-white/25 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white font-mono">{inv.invoiceNumber}</span>
                      <StatusPill status={inv.paymentStatus || inv.status || 'pending'} />
                    </div>
                    <p className="text-xs text-zinc-400">
                      Issued: {inv.issueDate} • Due: {inv.dueDate}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap shrink-0">
                    <div className="text-right font-mono">
                      <span className="text-lg font-extrabold text-white">
                        {formatCurrency(inv.total, inv.currency)}
                      </span>
                      <span className="text-[10px] text-zinc-500 block uppercase">{inv.currency}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedInvoiceModal(inv)}
                        leftIcon={<Eye className="w-3.5 h-3.5 text-blue-400" />}
                      >
                        Preview
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownloadClick(inv)}
                        leftIcon={<Download className="w-3.5 h-3.5 text-emerald-400" />}
                      >
                        PDF
                      </Button>

                      {!isPaid ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPaymentInstructionsModal(inv)}
                            leftIcon={<Landmark className="w-3.5 h-3.5 text-amber-400" />}
                          >
                            Bank Details
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onPayClick(inv)}
                            leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                          >
                            Pay Securely
                          </Button>
                        </>
                      ) : (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Paid
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Upgraded Canonical Invoice Document Modal - size="xl" guarantees zero squishing */}
      {selectedInvoiceModal && (
        <Modal
          isOpen={!!selectedInvoiceModal}
          onClose={() => setSelectedInvoiceModal(null)}
          title={`Statement #${selectedInvoiceModal.invoiceNumber}`}
          size="xl"
        >
          <div className="space-y-4 font-sans text-xs">
            {/* Export Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 border border-white/10">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleExportPDF(selectedInvoiceModal)}
                  disabled={!!exportingType}
                  aria-label="Download Invoice PDF"
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {exportingType === 'pdf' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>PDF</span>
                </button>

                <button
                  onClick={() => handleExportPNG(selectedInvoiceModal)}
                  disabled={!!exportingType}
                  aria-label="Download Invoice PNG"
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {exportingType === 'png' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                  <span>PNG</span>
                </button>

                <button
                  onClick={() => handleExportJPG(selectedInvoiceModal)}
                  disabled={!!exportingType}
                  aria-label="Download Invoice JPG"
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {exportingType === 'jpg' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-violet-400" />
                  )}
                  <span>JPG</span>
                </button>

                <button
                  onClick={() => handlePrint(selectedInvoiceModal)}
                  disabled={!!exportingType}
                  aria-label="Print Invoice"
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Print</span>
                </button>
              </div>

              {selectedInvoiceModal.paymentStatus !== 'paid' && selectedInvoiceModal.status !== 'paid' && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Option B: External Razorpay Payment Link */}
                  {selectedInvoiceModal.razorpayPaymentLink && isApprovedRazorpayUrl(selectedInvoiceModal.razorpayPaymentLink) && (
                    <a
                      href={selectedInvoiceModal.razorpayPaymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-sm cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Pay Online (Razorpay)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {/* Option A: Client Notify Payment */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenNotifyModal(selectedInvoiceModal)}
                    leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  >
                    Notify Payment
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const inv = selectedInvoiceModal;
                      setSelectedInvoiceModal(null);
                      onPayClick(inv);
                    }}
                    leftIcon={<CreditCard className="w-4 h-4" />}
                  >
                    Pay ({formatCurrency(selectedInvoiceModal.remainingBalance ?? selectedInvoiceModal.total, selectedInvoiceModal.currency)})
                  </Button>
                </div>
              )}
            </div>

            {/* Document Sheet with Responsive Scaling */}
            <div className="max-h-[65vh] overflow-y-auto p-4 rounded-xl bg-zinc-950/80 border border-white/5 flex justify-center">
              <InvoiceDocument
                ref={previewDocRef}
                invoice={selectedInvoiceModal}
                branding={effectiveBranding}
                responsiveScale={true}
                documentId={`client-portal-preview-${selectedInvoiceModal.id}`}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Bank & Manual Settlement Details Modal */}
      {paymentInstructionsModal && (
        <Modal
          isOpen={!!paymentInstructionsModal}
          onClose={() => setPaymentInstructionsModal(null)}
          title={`Payment Instructions — #${paymentInstructionsModal.invoiceNumber}`}
          size="lg"
        >
          <div className="space-y-4 font-sans text-xs">
            {/* Header info */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-zinc-400 block text-[11px]">Invoice:</span>
                <span className="font-mono text-white font-bold">{paymentInstructionsModal.invoiceNumber}</span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px]">Amount Due:</span>
                <span className="font-mono text-emerald-400 font-bold text-sm">
                  {formatCurrency(paymentInstructionsModal.remainingBalance ?? paymentInstructionsModal.total, paymentInstructionsModal.currency)}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px]">Due Date:</span>
                <span className="font-mono text-zinc-300">{paymentInstructionsModal.dueDate}</span>
              </div>
            </div>

            {/* Bank Transfer Details */}
            {paymentInstructionsModal.bankDetails && (paymentInstructionsModal.bankDetails.bankName || paymentInstructionsModal.bankDetails.accountNumber) && (
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-3">
                <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
                  <Landmark className="w-4 h-4 text-emerald-400" />
                  <span>Direct Bank Wire Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {paymentInstructionsModal.bankDetails.accountHolderName && (
                    <div className="p-2 rounded bg-black/40 border border-white/5">
                      <span className="text-zinc-400 block text-[10px]">Beneficiary Name</span>
                      <span className="font-semibold text-zinc-200">{paymentInstructionsModal.bankDetails.accountHolderName}</span>
                    </div>
                  )}
                  {paymentInstructionsModal.bankDetails.bankName && (
                    <div className="p-2 rounded bg-black/40 border border-white/5">
                      <span className="text-zinc-400 block text-[10px]">Bank Name</span>
                      <span className="font-semibold text-zinc-200">{paymentInstructionsModal.bankDetails.bankName}</span>
                    </div>
                  )}
                  {paymentInstructionsModal.bankDetails.accountNumber && (
                    <div className="p-2 rounded bg-black/40 border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-zinc-400 block text-[10px]">Account Number</span>
                        <span className="font-mono font-bold text-zinc-100">{paymentInstructionsModal.bankDetails.accountNumber}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(paymentInstructionsModal.bankDetails?.accountNumber || '', 'accNum')}
                        className="p-1 rounded bg-white/5 hover:bg-white/15 text-zinc-300"
                        title="Copy Account Number"
                      >
                        {copiedField === 'accNum' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                  {paymentInstructionsModal.bankDetails.ifscCode && (
                    <div className="p-2 rounded bg-black/40 border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-zinc-400 block text-[10px]">IFSC / SWIFT</span>
                        <span className="font-mono font-bold text-zinc-100">{paymentInstructionsModal.bankDetails.ifscCode}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(paymentInstructionsModal.bankDetails?.ifscCode || '', 'ifsc')}
                        className="p-1 rounded bg-white/5 hover:bg-white/15 text-zinc-300"
                        title="Copy IFSC"
                      >
                        {copiedField === 'ifsc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* UPI Payment Block */}
            {(paymentInstructionsModal.upiId || paymentInstructionsModal.upiQrCodeUrl) && (
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-zinc-200 font-bold text-xs">
                  <span>
                    {paymentInstructionsModal.upiQrCodeUrl && !paymentInstructionsModal.upiId
                      ? 'Scan & Pay QR (Instant)'
                      : 'UPI Direct Payment (Instant)'}
                  </span>
                  {paymentInstructionsModal.upiId && (
                    <button
                      type="button"
                      onClick={() => copyText(paymentInstructionsModal.upiId || '', 'upiId')}
                      className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                    >
                      {copiedField === 'upiId' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'upiId' ? 'Copied' : 'Copy VPA'}</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-1.5 bg-white rounded-lg shadow shrink-0 w-[108px] h-[108px] flex items-center justify-center overflow-hidden">
                    {paymentInstructionsModal.upiQrCodeUrl ? (
                      <img
                        src={paymentInstructionsModal.upiQrCodeUrl}
                        alt="Payment QR Code"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <QRCode
                        value={`upi://pay?pa=${encodeURIComponent(paymentInstructionsModal.upiId || '')}&pn=${encodeURIComponent(effectiveBranding.businessName || 'FlowDesk')}&am=${paymentInstructionsModal.remainingBalance ?? paymentInstructionsModal.total}&cu=${paymentInstructionsModal.currency || 'INR'}`}
                        size={96}
                        darkColor="#000000"
                        lightColor="#ffffff"
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    {paymentInstructionsModal.upiId && (
                      <p className="font-mono text-zinc-100 font-bold text-xs">{paymentInstructionsModal.upiId}</p>
                    )}
                    <p className="text-zinc-400 text-[11px]">
                      {paymentInstructionsModal.upiQrCodeUrl
                        ? 'Scan with any UPI / Banking app (PhonePe, GPay, Paytm).'
                        : 'Scan with Google Pay, PhonePe, Paytm, or BHIM.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* External Razorpay Link */}
            {paymentInstructionsModal.razorpayPaymentLink && isApprovedRazorpayUrl(paymentInstructionsModal.razorpayPaymentLink) && (
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs">
                    <ShieldCheck className="w-4 h-4" />
                    <span>External Razorpay Payment Page</span>
                  </div>
                  <a
                    href={paymentInstructionsModal.razorpayPaymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs"
                  >
                    <span>Open Payment Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-zinc-400 text-[11px]">
                  Pay securely with credit card, debit card, or net banking on freelancer&apos;s verified Razorpay page.
                </p>
              </div>
            )}

            {/* Actions footer */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <Button variant="ghost" onClick={() => setPaymentInstructionsModal(null)}>
                Close
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const inv = paymentInstructionsModal;
                    setPaymentInstructionsModal(null);
                    handleOpenNotifyModal(inv);
                  }}
                  leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                >
                  I Have Paid (Notify)
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Client Payment Notification Submission Modal */}
      {notifyModalInvoice && (
        <Modal
          isOpen={!!notifyModalInvoice}
          onClose={() => setNotifyModalInvoice(null)}
          title={`Notify Payment — #${notifyModalInvoice.invoiceNumber}`}
          size="md"
        >
          <form onSubmit={handleSubmitPaymentNotification} className="space-y-4 font-sans text-xs">
            <p className="text-zinc-300 text-xs">
              Submitted payment details will be recorded and marked as{' '}
              <strong className="text-amber-400">awaiting verification</strong>. The invoice will be officially marked paid
              once verified by the freelancer.
            </p>

            {notifySuccessMsg && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{notifySuccessMsg}</span>
              </div>
            )}

            {notifyErrorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{notifyErrorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-zinc-400 mb-1 text-[11px] font-semibold">Payment Method Used</label>
              <select
                value={notifyMethod}
                onChange={(e) => setNotifyMethod(e.target.value as any)}
                className="w-full bg-zinc-900 border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-emerald-500"
              >
                <option value="bank_transfer">Bank Wire / Transfer (NEFT / RTGS / IMPS)</option>
                <option value="upi">UPI / Instant Mobile Payment</option>
                <option value="razorpay">Razorpay Online Payment Link</option>
                <option value="other">Other / Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 text-[11px] font-semibold">
                Transaction Reference / UTR Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. UTR1234567890 or Bank Ref ID"
                value={notifyRef}
                onChange={(e) => setNotifyRef(e.target.value)}
                className="w-full bg-zinc-900 border border-white/15 rounded-lg px-3 py-2 text-white font-mono text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 text-[11px] font-semibold">
                Amount Paid ({notifyModalInvoice.currency}) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={notifyAmount}
                onChange={(e) => setNotifyAmount(e.target.value)}
                className="w-full bg-zinc-900 border border-white/15 rounded-lg px-3 py-2 text-white font-mono text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-zinc-400 mb-1 text-[11px] font-semibold">Notes / Remarks (Optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. Transferred from HDFC account ending in 4321"
                value={notifyNotes}
                onChange={(e) => setNotifyNotes(e.target.value)}
                className="w-full bg-zinc-900 border border-white/15 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={() => setNotifyModalInvoice(null)} disabled={isSubmittingNotify}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmittingNotify}>
                {isSubmittingNotify ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Payment Reference'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

