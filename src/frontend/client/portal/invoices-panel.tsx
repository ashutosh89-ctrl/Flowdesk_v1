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
  QrCode,
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
              {formatCurrency(totalOutstanding, invoices[0]?.currency || 'INR')}
            </h2>
            <p className="text-xs text-zinc-300 mt-0.5">
              {totalOutstanding > 0 ? 'Outstanding balance awaiting settlement' : 'All statements settled'}
            </p>
          </div>

          <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'unpaid', label: 'Unpaid' },
              { id: 'paid', label: 'Paid' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center justify-center ${
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
            const invQrUrl =
              inv.upiQrCodeUrl ||
              inv.paymentMethods?.upiQrCodeUrl ||
              (effectiveBranding as any)?.upiQrCodeUrl ||
              (effectiveBranding as any)?.upi_qr_code_url;
            const invUpiId =
              inv.upiId ||
              inv.paymentMethods?.upiId ||
              inv.bankDetails?.upiId ||
              (effectiveBranding as any)?.upiId ||
              (effectiveBranding as any)?.upi_id ||
              (effectiveBranding as any)?.bankDetails?.upiId;
            const hasInvQr = Boolean(invQrUrl || invUpiId);
            const remaining = inv.remainingBalance ?? inv.total;
            const upiDeepLink = invUpiId
              ? `upi://pay?pa=${encodeURIComponent(invUpiId)}&pn=${encodeURIComponent((effectiveBranding as any)?.businessName || 'FlowDesk')}&am=${remaining}&cu=${inv.currency || 'INR'}&tn=${encodeURIComponent(`Invoice ${inv.invoiceNumber}`)}`
              : '';

            return (
              <Card key={inv.id} variant="crystal" className="p-4 sm:p-5 border-white/15 hover:border-white/25 transition-all space-y-3.5">
                {/* Header & Amount row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white font-mono">{inv.invoiceNumber}</span>
                      <StatusPill status={inv.paymentStatus || inv.status || 'pending'} />
                    </div>
                    <p className="text-xs text-zinc-400">
                      Issued: {inv.issueDate} • Due: {inv.dueDate}
                    </p>
                  </div>

                  <div className="flex items-baseline sm:items-end justify-between sm:justify-start gap-2 pt-1 sm:pt-0 border-t border-white/5 sm:border-0">
                    <span className="text-xs text-zinc-400 sm:hidden">Statement Total:</span>
                    <div className="text-right font-mono">
                      <span className="text-xl sm:text-lg font-extrabold text-[#43D6B0] sm:text-white">
                        {formatCurrency(inv.total, inv.currency)}
                      </span>
                      <span className="text-[10px] text-zinc-500 block uppercase">{inv.currency}</span>
                    </div>
                  </div>
                </div>

                {/* Actions row: Clean on phone & desktop */}
                <div className="pt-2.5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full sm:w-auto justify-center text-xs"
                      onClick={() => setSelectedInvoiceModal(inv)}
                      leftIcon={<Eye className="w-3.5 h-3.5 text-[#43D6B0]" />}
                    >
                      Preview
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full sm:w-auto justify-center text-xs"
                      onClick={() => onDownloadClick(inv)}
                      leftIcon={<Download className="w-3.5 h-3.5 text-emerald-400" />}
                    >
                      PDF
                    </Button>

                    {!isPaid && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full sm:w-auto justify-center text-xs"
                          onClick={() => setPaymentInstructionsModal(inv)}
                          leftIcon={<Landmark className="w-3.5 h-3.5 text-amber-400" />}
                        >
                          Bank Details
                        </Button>

                        {hasInvQr && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full sm:w-auto justify-center text-xs"
                            onClick={() => onPayClick(inv)}
                            leftIcon={<QrCode className="w-3.5 h-3.5 text-emerald-400" />}
                          >
                            QR Code
                          </Button>
                        )}
                      </>
                    )}
                  </div>

                  {!isPaid ? (
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full sm:w-auto justify-center font-bold shadow-md text-xs py-2 sm:py-1.5"
                      onClick={() => onPayClick(inv)}
                      leftIcon={<CreditCard className="w-4 h-4" />}
                    >
                      Pay Securely
                    </Button>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 self-stretch sm:self-auto">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Paid
                    </span>
                  )}
                </div>

                {/* Direct Attached QR Code Section on Invoice Card */}
                {hasInvQr && !isPaid && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div
                        onClick={() => onPayClick(inv)}
                        className="w-14 h-14 p-1 bg-white rounded-lg shadow shrink-0 flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                        title="Click to view QR in payment modal"
                      >
                        {invQrUrl ? (
                          <img src={invQrUrl} alt="Invoice QR" className="w-full h-full object-contain" />
                        ) : (
                          <QRCode value={upiDeepLink} size={48} darkColor="#000000" lightColor="#ffffff" />
                        )}
                      </div>
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono uppercase font-bold text-emerald-400">
                            Attached QR Payment
                          </span>
                          {invUpiId && (
                            <button
                              type="button"
                              onClick={() => copyText(invUpiId, `card-upi-${inv.id}`)}
                              className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 cursor-pointer"
                            >
                              {copiedField === `card-upi-${inv.id}` ? (
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                              <span className="font-mono text-[10px] truncate max-w-[140px] sm:max-w-none">{invUpiId}</span>
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-300">
                          Scan with PhonePe, GPay, Paytm, BHIM to settle{' '}
                          <strong className="text-white font-mono">{formatCurrency(remaining, inv.currency)}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full sm:w-auto justify-center"
                        onClick={() => onPayClick(inv)}
                        leftIcon={<QrCode className="w-3.5 h-3.5 text-emerald-400" />}
                      >
                        Scan QR Code
                      </Button>
                    </div>
                  </div>
                )}
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#43D6B0] hover:bg-[#43D6B0]/90 text-[#101312] font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Pay Online (Razorpay)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {/* Option QR: Scan & Pay QR */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const inv = selectedInvoiceModal;
                      setSelectedInvoiceModal(null);
                      onPayClick(inv);
                    }}
                    leftIcon={<QrCode className="w-4 h-4 text-emerald-400" />}
                  >
                    Scan QR
                  </Button>

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

            {/* Bank Transfer Details & UPI Payment Blocks */}
            {(() => {
              const bDetails =
                paymentInstructionsModal.bankDetails ||
                paymentInstructionsModal.paymentMethods?.bankDetails ||
                (effectiveBranding as any)?.bankDetails ||
                (effectiveBranding as any)?.payment_settings?.bankDetails ||
                {};
              const bName =
                bDetails.bankName ||
                bDetails.bank_name ||
                (effectiveBranding as any)?.bankName ||
                (effectiveBranding as any)?.bank_name ||
                '';
              const bAcc =
                bDetails.accountNumber ||
                bDetails.account_number ||
                (effectiveBranding as any)?.accountNumber ||
                (effectiveBranding as any)?.account_number ||
                '';
              const bHolder =
                bDetails.accountHolderName ||
                bDetails.account_holder_name ||
                (effectiveBranding as any)?.accountHolderName ||
                (effectiveBranding as any)?.account_holder_name ||
                (effectiveBranding as any)?.name ||
                '';
              const bIfsc =
                bDetails.ifscCode ||
                bDetails.ifsc_code ||
                bDetails.swiftCode ||
                bDetails.swift_code ||
                (effectiveBranding as any)?.ifscCode ||
                (effectiveBranding as any)?.ifsc_code ||
                '';
              const bBranch =
                bDetails.branchName ||
                bDetails.branch_name ||
                (effectiveBranding as any)?.branchName ||
                (effectiveBranding as any)?.branch_name ||
                '';

              const mUpiId =
                paymentInstructionsModal.upiId ||
                paymentInstructionsModal.paymentMethods?.upiId ||
                bDetails.upiId ||
                bDetails.upi_id ||
                (effectiveBranding as any)?.upiId ||
                (effectiveBranding as any)?.upi_id ||
                (effectiveBranding as any)?.payment_settings?.upiId ||
                '';

              const mQrUrl =
                paymentInstructionsModal.upiQrCodeUrl ||
                paymentInstructionsModal.paymentMethods?.upiQrCodeUrl ||
                bDetails.upiQrCodeUrl ||
                bDetails.upi_qr_code_url ||
                (effectiveBranding as any)?.upiQrCodeUrl ||
                (effectiveBranding as any)?.upi_qr_code_url ||
                (effectiveBranding as any)?.payment_settings?.upiQrCodeUrl ||
                '';

              const hasBankInfo = Boolean(bName || bAcc);
              const hasUpiInfo = Boolean(mUpiId || mQrUrl);

              return (
                <>
                  {/* Bank Transfer Details */}
                  {hasBankInfo && (
                    <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-3">
                      <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
                        <Landmark className="w-4 h-4 text-emerald-400" />
                        <span>Direct Bank Wire Details</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        {bHolder && (
                          <div className="p-2 rounded bg-black/40 border border-white/5">
                            <span className="text-zinc-400 block text-[10px]">Beneficiary Name</span>
                            <span className="font-semibold text-zinc-200">{bHolder}</span>
                          </div>
                        )}
                        {bName && (
                          <div className="p-2 rounded bg-black/40 border border-white/5">
                            <span className="text-zinc-400 block text-[10px]">Bank Name</span>
                            <span className="font-semibold text-zinc-200">{bName}</span>
                          </div>
                        )}
                        {bAcc && (
                          <div className="p-2 rounded bg-black/40 border border-white/5 flex items-center justify-between">
                            <div>
                              <span className="text-zinc-400 block text-[10px]">Account Number</span>
                              <span className="font-mono font-bold text-zinc-100">{bAcc}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyText(bAcc, 'accNum')}
                              className="p-1 rounded bg-white/5 hover:bg-white/15 text-zinc-300 transition-colors"
                              title="Copy Account Number"
                            >
                              {copiedField === 'accNum' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                        {bIfsc && (
                          <div className="p-2 rounded bg-black/40 border border-white/5 flex items-center justify-between">
                            <div>
                              <span className="text-zinc-400 block text-[10px]">IFSC / SWIFT</span>
                              <span className="font-mono font-bold text-zinc-100">{bIfsc}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyText(bIfsc, 'ifsc')}
                              className="p-1 rounded bg-white/5 hover:bg-white/15 text-zinc-300 transition-colors"
                              title="Copy IFSC"
                            >
                              {copiedField === 'ifsc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        )}
                        {bBranch && (
                          <div className="p-2 rounded bg-black/40 border border-white/5 sm:col-span-2">
                            <span className="text-zinc-400 block text-[10px]">Branch</span>
                            <span className="text-zinc-300">{bBranch}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* UPI Payment Block */}
                  {hasUpiInfo && (
                    <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between text-zinc-200 font-bold text-xs">
                        <span>
                          {mQrUrl && !mUpiId
                            ? 'Scan & Pay QR (Instant)'
                            : 'UPI Direct Payment (Instant)'}
                        </span>
                        {mUpiId && (
                          <button
                            type="button"
                            onClick={() => copyText(mUpiId, 'upiId')}
                            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors"
                          >
                            {copiedField === 'upiId' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedField === 'upiId' ? 'Copied' : 'Copy VPA'}</span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="p-1.5 bg-white rounded-lg shadow shrink-0 w-[108px] h-[108px] flex items-center justify-center overflow-hidden">
                          {mQrUrl ? (
                            <img
                              src={mQrUrl}
                              alt="Payment QR Code"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <QRCode
                              value={`upi://pay?pa=${encodeURIComponent(mUpiId)}&pn=${encodeURIComponent((effectiveBranding as any)?.businessName || 'FlowDesk')}&am=${paymentInstructionsModal.remainingBalance ?? paymentInstructionsModal.total}&cu=${paymentInstructionsModal.currency || 'INR'}`}
                              size={96}
                              darkColor="#000000"
                              lightColor="#ffffff"
                            />
                          )}
                        </div>
                        <div className="space-y-1">
                          {mUpiId && (
                            <p className="font-mono text-zinc-100 font-bold text-xs">{mUpiId}</p>
                          )}
                          <p className="text-zinc-400 text-[11px]">
                            {mQrUrl
                              ? 'Scan with any UPI / Banking app (PhonePe, GPay, Paytm).'
                              : 'Scan with Google Pay, PhonePe, Paytm, or BHIM.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* External Razorpay Link */}
            {paymentInstructionsModal.razorpayPaymentLink && isApprovedRazorpayUrl(paymentInstructionsModal.razorpayPaymentLink) && (
              <div className="p-4 rounded-xl bg-[#176B5B]/15 border border-[#176B5B]/35 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#43D6B0] font-semibold text-xs">
                    <ShieldCheck className="w-4 h-4" />
                    <span>External Razorpay Payment Page</span>
                  </div>
                  <a
                    href={paymentInstructionsModal.razorpayPaymentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#43D6B0] hover:bg-[#43D6B0]/90 text-[#101312] font-semibold text-xs"
                  >
                    <span>Open Payment Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[#A6B4AE] text-[11px]">
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

