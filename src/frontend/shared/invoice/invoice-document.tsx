'use client';

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Invoice, UserProfile, InvoiceBranding } from '@/shared/types';
import { formatCurrency, getCurrencySymbol } from '@/shared/utils/currency';
import { convertAmountToWords } from '@/shared/utils/number-to-words';
import { isSafeHttpUrl, isSafeImageUrl } from '@/shared/utils/safe-url';

import { Building2, Landmark, QrCode, ExternalLink, Check, Copy, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { QRCode } from '@/frontend/shared/ui/qr-code';

export interface InvoiceDocumentProps {
  invoice: Invoice;
  branding?: InvoiceBranding | UserProfile | null;
  /**
   * If true, enables responsive container scaling to fit smaller screens (mobile/tablet).
   * Note: The document DOM itself remains fixed A4 (794px) to guarantee export quality.
   */
  responsiveScale?: boolean;
  /**
   * Custom CSS class names applied to the root wrapper.
   */
  className?: string;
  /**
   * Optional custom ID for DOM targeting during export.
   */
  documentId?: string;
  /**
   * Optional watermark override. By default derived from invoice status.
   */
  showWatermark?: boolean;
}

/**
 * Generates an SVG QR code for UPI payments or payment links.
 */
function UPIPaymentQR({
  upiId,
  upiQrCodeUrl,
  amount,
  payeeName,
  invoiceNumber,
  currency = 'INR',
}: {
  upiId?: string;
  upiQrCodeUrl?: string;
  amount: number;
  payeeName: string;
  invoiceNumber: string;
  currency?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!upiId && !upiQrCodeUrl) return null;

  const upiUrl = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=${currency}`
    : '';

  const copyToClipboard = () => {
    if (!upiId) return;
    try {
      navigator.clipboard?.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200">
      <div className="w-[84px] h-[84px] p-1 bg-white border border-zinc-200 rounded flex items-center justify-center shrink-0 overflow-hidden">
        {upiQrCodeUrl ? (
          <img
            src={upiQrCodeUrl}
            alt="Payment QR Code"
            className="w-full h-full object-contain"
          />
        ) : (
          <QRCode value={upiUrl} size={76} darkColor="#09090b" lightColor="#ffffff" />
        )}
      </div>
      <div className="text-[11px] space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-zinc-900 uppercase text-[10px]">
            {upiQrCodeUrl && !upiId ? 'Scan & Pay QR' : 'UPI Payment'}
          </span>
          {upiId && (
            <button
              type="button"
              onClick={copyToClipboard}
              className="text-[10px] text-zinc-500 hover:text-zinc-900 flex items-center gap-0.5 px-1 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200"
              title="Copy UPI ID"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span className="text-[9px]">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>
        {upiId && <p className="font-mono text-zinc-800 text-[10px] break-all">{upiId}</p>}
        <p className="text-[9px] text-zinc-500">
          {upiQrCodeUrl ? 'Scan with any UPI / Banking app' : 'Scan with GPay, PhonePe, Paytm, or BHIM'}
        </p>
      </div>
    </div>
  );
}

/**
 * Canonical FlowDesk Invoice Document Renderer.
 * Designed to A4 standards (794px × 1123px at 96 DPI / standard print ratio).
 * Shared across Freelancer Studio, Client Portal, and Export Engines (PDF, PNG, JPG, Print).
 */
export const InvoiceDocument = forwardRef<HTMLDivElement, InvoiceDocumentProps>(
  (
    {
      invoice,
      branding,
      responsiveScale = false,
      className = '',
      documentId = `flowdesk-invoice-${invoice.id || invoice.invoiceNumber}`,
      showWatermark = true,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState<number>(1);

    // Business & Freelancer details resolution
    const studioName =
      (branding as InvoiceBranding)?.businessName ||
      (branding as UserProfile)?.companyName ||
      (branding as any)?.name ||
      'FlowDesk Freelance Studio';

    const studioEmail =
      (branding as InvoiceBranding)?.email ||
      (branding as UserProfile)?.email ||
      '';

    const studioPhone =
      (branding as InvoiceBranding)?.phone ||
      (branding as UserProfile)?.phone ||
      '';

    const studioAddress =
      (branding as UserProfile)?.address ||
      (branding as any)?.address ||
      '';

    const studioTaxId =
      (branding as any)?.gstin ||
      (branding as any)?.taxId ||
      (branding as any)?.taxNumber ||
      '';

    const logoUrl =
      (branding as InvoiceBranding)?.logoUrl ||
      (branding as UserProfile)?.logoUrl ||
      '';

    const signatureUrl =
      (branding as InvoiceBranding)?.signatureUrl ||
      (branding as UserProfile)?.signatureUrl ||
      '';

    const upiQrCodeUrl =
      invoice.upiQrCodeUrl ||
      invoice.paymentMethods?.upiQrCodeUrl ||
      (branding as any)?.upiQrCodeUrl ||
      '';

    // Bank & Payment Details resolution from invoice or branding
    const methodsConfig = invoice.paymentMethods || {
      bankTransferEnabled: true,
      upiEnabled: Boolean(
        invoice.upiId ||
        upiQrCodeUrl ||
        (branding as any)?.upiId ||
        (branding as any)?.bankDetails?.upiId
      ),
      razorpayLinkEnabled: Boolean(invoice.razorpayPaymentLink || (branding as any)?.razorpayPaymentLink),
    };

    const invoiceBankDetails = invoice.bankDetails || (branding as any)?.bankDetails || {};
    const accountHolderName = invoiceBankDetails.accountHolderName || (branding as any)?.accountHolderName || '';
    const bankName = invoiceBankDetails.bankName || (branding as any)?.bankName || '';
    const accountNumber = invoiceBankDetails.accountNumber || (branding as any)?.accountNumber || '';
    const ifscCode = invoiceBankDetails.ifscCode || invoiceBankDetails.swiftCode || (branding as any)?.ifscCode || '';
    const branchName = invoiceBankDetails.branchName || (branding as any)?.branchName || '';
    const upiId = invoice.upiId || invoiceBankDetails.upiId || (branding as any)?.upiId || '';
    const razorpayLink = invoice.razorpayPaymentLink || (branding as any)?.razorpayPaymentLink || '';

    const isUpiAvailable = Boolean(upiId || upiQrCodeUrl);
    const shouldShowUpi = isUpiAvailable && methodsConfig.upiEnabled !== false;

    // Status & Watermark logic
    const status = (invoice.paymentStatus || invoice.status || 'draft').toUpperCase();
    const isPaid = status === 'PAID';
    const isOverdue = status === 'OVERDUE';
    const isCancelled = invoice.workflowStatus === 'cancelled' || status === 'CANCELLED';

    // Amount Calculations & Words
    const currency = invoice.currency || 'USD';
    const subtotal = invoice.subtotal || 0;
    const discount = invoice.discount || 0;
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = invoice.tax || 0;
    const total = invoice.total || 0;
    const paidAmount = invoice.paidAmount || 0;
    const remainingBalance = invoice.remainingBalance ?? Math.max(0, total - paidAmount);

    // Round-off delta calculation (if total has rounding adjustment)
    const rawCalculatedTotal = taxableAmount + tax;
    const roundOffDelta = Number((total - rawCalculatedTotal).toFixed(2));

    const amountInWords = convertAmountToWords(total, currency);

    // Responsive scaling effect
    useEffect(() => {
      if (!responsiveScale) return;

      const updateScale = () => {
        if (containerRef.current) {
          const parentWidth = containerRef.current.parentElement?.clientWidth || window.innerWidth;
          const targetWidth = 794; // Fixed standard A4 width
          if (parentWidth < targetWidth + 32) {
            const computedScale = Math.max(0.35, Math.min(1, (parentWidth - 24) / targetWidth));
            setScale(computedScale);
          } else {
            setScale(1);
          }
        }
      };

      updateScale();
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }, [responsiveScale]);

    // Parse terms and conditions into clean list
    const termsList: string[] = [];
    if (invoice.notes && invoice.notes.trim()) {
      const splitLines = invoice.notes.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      splitLines.forEach((line) => {
        // Strip leading numbers like "1.", "1)", "-" if present
        const clean = line.replace(/^(\d+[\.\)]|\-|\*)\s*/, '');
        if (clean) termsList.push(clean);
      });
    }
    if (termsList.length === 0) {
      termsList.push('Payment is due within standard agreed terms from the date of issue.');
      termsList.push('Please quote the invoice reference number on all electronic payments.');
      termsList.push('For questions regarding this invoice, please contact the email above.');
    }

    return (
      <div
        ref={containerRef}
        className={`invoice-document-wrapper flex justify-center w-full overflow-hidden ${className}`}
        style={{
          minHeight: responsiveScale ? `${1123 * scale}px` : 'auto',
        }}
      >
        <div
          ref={ref}
          id={documentId}
          data-invoice-number={invoice.invoiceNumber}
          style={{
            transform: responsiveScale && scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'top center',
          }}
          className="invoice-document-sheet relative w-[794px] min-h-[1123px] bg-white text-zinc-900 p-10 font-sans shadow-2xl border border-zinc-200 select-text print:shadow-none print:border-none print:m-0 print:p-8"
        >
          {/* Subtle Watermark Stamp */}
          {showWatermark && (isPaid || isOverdue || isCancelled) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 overflow-hidden">
              <div
                className={`text-[88px] font-black uppercase tracking-widest rotate-[-30deg] border-8 px-10 py-3 rounded-3xl opacity-10 ${
                  isPaid
                    ? 'text-emerald-700 border-emerald-700'
                    : isCancelled
                    ? 'text-zinc-500 border-zinc-500'
                    : 'text-rose-700 border-rose-700'
                }`}
              >
                {isPaid ? 'PAID' : isCancelled ? 'CANCELLED' : 'OVERDUE'}
              </div>
            </div>
          )}

          {/* ════════════════ HEADER SECTION ════════════════ */}
          <div className="flex items-start justify-between gap-6 pb-6 border-b border-zinc-300">
            {/* Business / Studio Info (Left) */}
            <div className="flex items-start gap-4 max-w-[60%]">
              {logoUrl && isSafeImageUrl(logoUrl) ? (
                <img
                  src={logoUrl}
                  alt={studioName}
                  crossOrigin="anonymous"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.includes('/api/image-proxy') && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'))) {
                      target.src = `/api/image-proxy?url=${encodeURIComponent(logoUrl)}`;
                    }
                  }}
                  className="h-14 w-auto max-w-[140px] object-contain rounded-lg shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-200 flex items-center justify-center shrink-0 shadow-sm overflow-hidden p-1.5">
                  <img
                    src="/branding/flowdesk-symbol.png"
                    alt="FlowDesk Studio"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="space-y-1">
                <h1 className="text-xl font-bold tracking-tight text-zinc-950 leading-tight">
                  {studioName}
                </h1>
                {studioTaxId && (
                  <p className="text-xs font-semibold text-zinc-700">
                    GSTIN / Tax ID: <span className="font-mono text-zinc-900">{studioTaxId}</span>
                  </p>
                )}
                <p className="text-[11px] text-zinc-600 leading-snug">
                  {studioPhone && <span>Phone: {studioPhone}</span>}
                  {studioPhone && studioEmail && <span> | </span>}
                  {studioEmail && <span>Email: {studioEmail}</span>}
                </p>
                {studioAddress && (
                  <p className="text-[11px] text-zinc-500 leading-snug">{studioAddress}</p>
                )}
              </div>
            </div>

            {/* Document Title & Invoice Meta (Right) */}
            <div className="text-right space-y-1">
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-950">
                {studioTaxId ? 'TAX INVOICE' : 'INVOICE'}
              </h2>
              <div className="space-y-0.5 text-xs text-zinc-700 font-medium">
                <p>
                  <span className="text-zinc-500">Invoice No:</span>{' '}
                  <strong className="font-mono font-bold text-zinc-950 text-sm">{invoice.invoiceNumber}</strong>
                </p>
                <p>
                  <span className="text-zinc-500">Date of Issue:</span>{' '}
                  <strong className="text-zinc-900">{invoice.issueDate || 'N/A'}</strong>
                </p>
                <p>
                  <span className="text-zinc-500">Due Date:</span>{' '}
                  <strong className="text-zinc-900">{invoice.dueDate || 'N/A'}</strong>
                </p>
                {invoice.projectName && (
                  <p>
                    <span className="text-zinc-500">Ref / Project:</span>{' '}
                    <strong className="text-zinc-900">{invoice.projectName}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ════════════════ BILL TO (RECIPIENT) ════════════════ */}
          <div className="py-4 border-b border-zinc-200">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
              BILL TO (RECIPIENT)
            </h3>
            <div className="text-xs space-y-0.5">
              <p className="text-sm font-bold text-zinc-950">
                {invoice.clientName || 'Client Workspace'}
              </p>
              {invoice.clientEmail && (
                <p className="text-zinc-600">Email: {invoice.clientEmail}</p>
              )}
            </div>
          </div>

          {/* ════════════════ PAYMENT NOTIFICATION STATUS BANNER ════════════════ */}
          {invoice.paymentNotification && (
            <div
              className={`my-4 p-3 rounded-xl border flex items-start gap-3 ${
                invoice.paymentNotification.status === 'confirmed'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : invoice.paymentNotification.status === 'rejected'
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              {invoice.paymentNotification.status === 'confirmed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-0.5">
                <p className="font-bold">
                  {invoice.paymentNotification.status === 'confirmed'
                    ? 'Payment Confirmed by Freelancer'
                    : invoice.paymentNotification.status === 'rejected'
                    ? 'Payment Reference Rejected'
                    : 'Payment Submitted — Awaiting Verification'}
                </p>
                <p className="text-[11px] text-zinc-700">
                  Client Reference:{' '}
                  <strong className="font-mono text-zinc-950 font-bold">
                    {invoice.paymentNotification.transactionReference}
                  </strong>{' '}
                  ({formatCurrency(invoice.paymentNotification.amount, currency)}) via{' '}
                  <span className="capitalize font-medium">
                    {invoice.paymentNotification.paymentMethod.replace('_', ' ')}
                  </span>
                  {invoice.paymentNotification.status === 'awaiting_verification' &&
                    ' • Freelancer must confirm receipt before invoice is marked paid.'}
                </p>
              </div>
            </div>
          )}

          {/* ════════════════ LINE ITEMS TABLE ════════════════ */}
          <div className="py-4">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-zinc-800 text-zinc-900 font-bold text-[11px]">
                  <th className="py-2.5 px-2 text-left w-10">Sr.</th>
                  <th className="py-2.5 px-2 text-left">Item / Description</th>
                  <th className="py-2.5 px-2 text-right w-16">Qty</th>
                  <th className="py-2.5 px-2 text-right w-24">Rate ({getCurrencySymbol(currency)})</th>
                  {discount > 0 && <th className="py-2.5 px-2 text-right w-20">Disc</th>}
                  {tax > 0 && <th className="py-2.5 px-2 text-right w-16">Tax %</th>}
                  <th className="py-2.5 px-2 text-right w-28">Total ({getCurrencySymbol(currency)})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {(invoice.items || []).map((item, idx) => {
                  const qty = item.quantity || 1;
                  const rate = item.rate || 0;
                  const itemAmount = item.amount || qty * rate;

                  return (
                    <tr key={item.id || idx} className="hover:bg-zinc-50/50">
                      <td className="py-3 px-2 text-zinc-500 font-mono text-[11px] align-top">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-2 text-zinc-900 font-medium align-top">
                        <div className="font-semibold text-zinc-950">{item.description || 'Deliverable Item'}</div>
                      </td>
                      <td className="py-3 px-2 text-right text-zinc-700 font-mono align-top">
                        {qty}
                      </td>
                      <td className="py-3 px-2 text-right text-zinc-700 font-mono align-top">
                        {formatCurrency(rate, currency)}
                      </td>
                      {discount > 0 && (
                        <td className="py-3 px-2 text-right text-zinc-500 font-mono align-top">
                          -
                        </td>
                      )}
                      {tax > 0 && (
                        <td className="py-3 px-2 text-right text-zinc-600 font-mono align-top">
                          {invoice.taxPercentage || 0}%
                        </td>
                      )}
                      <td className="py-3 px-2 text-right text-zinc-950 font-bold font-mono align-top">
                        {formatCurrency(itemAmount, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ════════════════ FINANCIAL SUMMARY & BANK DETAILS GRID ════════════════ */}
          {/* ════════════════ FINANCIAL SUMMARY & PAYMENT METHODS GRID ════════════════ */}
          <div className="pt-2 pb-6 border-t-2 border-zinc-300 grid grid-cols-1 sm:grid-cols-2 gap-8 items-start">
            {/* Left: Dual Payment Methods (Bank Transfer + UPI QR + Razorpay Link) */}
            <div className="space-y-4 text-xs">
              {/* Method 1: Bank Transfer Details */}
              {methodsConfig.bankTransferEnabled !== false && (bankName || accountNumber || !upiId) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-zinc-900 font-bold tracking-tight uppercase text-[11px]">
                    <Landmark className="w-3.5 h-3.5 text-zinc-700" />
                    <span>BANK TRANSFER DETAILS</span>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-1 text-zinc-700 text-[11px]">
                    {accountHolderName && (
                      <p>
                        <span className="text-zinc-500">Account Holder:</span> <strong>{accountHolderName}</strong>
                      </p>
                    )}
                    {bankName && (
                      <p>
                        <span className="text-zinc-500">Bank Name:</span> <strong>{bankName}</strong>
                      </p>
                    )}
                    {accountNumber && (
                      <p>
                        <span className="text-zinc-500">A/C Number:</span>{' '}
                        <strong className="font-mono">{accountNumber}</strong>
                      </p>
                    )}
                    {ifscCode && (
                      <p>
                        <span className="text-zinc-500">IFSC / SWIFT:</span>{' '}
                        <strong className="font-mono">{ifscCode}</strong>
                      </p>
                    )}
                    {branchName && (
                      <p>
                        <span className="text-zinc-500">Branch:</span> {branchName}
                      </p>
                    )}
                    {!bankName && !accountNumber && (
                      <p className="text-zinc-500 italic">
                        {invoice.paymentInstructions || 'Standard electronic bank transfer accepted.'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Method 2: UPI Payment Block */}
              {shouldShowUpi && (
                <div className="space-y-1">
                  <UPIPaymentQR
                    upiId={upiId}
                    upiQrCodeUrl={upiQrCodeUrl}
                    amount={remainingBalance > 0 ? remainingBalance : total}
                    payeeName={studioName}
                    invoiceNumber={invoice.invoiceNumber}
                    currency={currency}
                  />
                </div>
              )}

              {/* Method 3: Razorpay Payment Link Block */}
              {methodsConfig.razorpayLinkEnabled !== false && razorpayLink && (
                <div className="space-y-1.5 p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-[11px]">
                  <div className="flex items-center justify-between font-bold text-blue-900 uppercase text-[10px]">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      Razorpay Online Payment Link
                    </span>
                  </div>
                  <p className="text-zinc-600 text-[10px]">
                    Verified external payment link configured by freelancer:
                  </p>
                  <a
                    href={razorpayLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-700 hover:text-blue-900 underline break-all font-medium"
                  >
                    <span>{razorpayLink}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
              )}
            </div>

            {/* Right: Calculations & Totals Box */}
            <div className="space-y-2 text-xs">
              <div className="bg-zinc-50 border border-zinc-300 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal (Pre-Tax):</span>
                  <span className="font-mono font-semibold text-zinc-900">
                    {formatCurrency(subtotal, currency)}
                  </span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span className="font-mono font-semibold">
                      -{formatCurrency(discount, currency)}
                    </span>
                  </div>
                )}

                {discount > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Taxable Amount:</span>
                    <span className="font-mono font-semibold text-zinc-900">
                      {formatCurrency(taxableAmount, currency)}
                    </span>
                  </div>
                )}

                {tax > 0 && (
                  <div className="flex justify-between text-zinc-600">
                    <span>
                      {invoice.taxName || 'Tax'} ({invoice.taxPercentage || 0}%):
                    </span>
                    <span className="font-mono font-semibold text-zinc-900">
                      {formatCurrency(tax, currency)}
                    </span>
                  </div>
                )}

                {roundOffDelta !== 0 && (
                  <div className="flex justify-between text-zinc-500 text-[11px]">
                    <span>Round-off Delta:</span>
                    <span className="font-mono">
                      {roundOffDelta > 0 ? `+${roundOffDelta}` : roundOffDelta}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t-2 border-zinc-400 flex justify-between items-center text-sm font-black text-zinc-950">
                  <span className="uppercase tracking-wide text-xs">Grand Total:</span>
                  <span className="font-mono text-base font-extrabold text-zinc-950">
                    {formatCurrency(total, currency)}
                  </span>
                </div>

                {/* Paid & Remaining Balance if partially paid */}
                {paidAmount > 0 && (
                  <>
                    <div className="pt-1.5 border-t border-zinc-200 flex justify-between text-emerald-700 text-xs">
                      <span>Amount Settled:</span>
                      <span className="font-mono font-semibold">
                        -{formatCurrency(paidAmount, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-amber-700 font-bold text-xs">
                      <span>Balance Due:</span>
                      <span className="font-mono">
                        {formatCurrency(remainingBalance, currency)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ════════════════ AMOUNT IN WORDS BANNER ════════════════ */}
          <div className="py-3 px-4 bg-zinc-100/90 border border-zinc-200 rounded-lg text-xs flex flex-wrap items-center gap-2 mb-6">
            <span className="font-bold text-zinc-800 uppercase text-[10px] tracking-wider shrink-0">
              AMOUNT IN WORDS:
            </span>
            <span className="font-semibold text-zinc-900 italic">{amountInWords}</span>
          </div>

          {/* ════════════════ TERMS & SIGNATURE FOOTER ════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-end pt-4 border-t border-zinc-200">
            {/* Terms & Conditions (Left) */}
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-700">
                TERMS & CONDITIONS
              </h4>
              <ol className="list-decimal list-inside text-[10px] text-zinc-600 space-y-0.5 leading-relaxed">
                {termsList.map((term, i) => (
                  <li key={i}>{term}</li>
                ))}
              </ol>
            </div>

            {/* Authorized Signatory Block (Right) */}
            <div className="text-right space-y-2">
              <p className="text-xs font-semibold text-zinc-800">
                for <strong className="text-zinc-950">{studioName}</strong>
              </p>
              <div className="h-16 flex items-center justify-end">
                {signatureUrl && isSafeImageUrl(signatureUrl) ? (
                  <img
                    src={signatureUrl}
                    alt="Authorized Signature"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.includes('/api/image-proxy') && (signatureUrl.startsWith('http://') || signatureUrl.startsWith('https://'))) {
                        target.src = `/api/image-proxy?url=${encodeURIComponent(signatureUrl)}`;
                      }
                    }}
                    className="max-h-14 w-auto max-w-[140px] object-contain"
                  />
                ) : (
                  <div className="w-32 border-b border-zinc-400"></div>
                )}
              </div>

              <p className="text-[10px] font-medium text-zinc-500 border-t border-zinc-300 pt-1 inline-block min-w-[180px]">
                Authorized Representative Sign/Seal
              </p>
            </div>
          </div>

          {/* Bottom Generation Tag */}
          <div className="mt-8 pt-3 border-t border-zinc-100 flex justify-between items-center text-[9px] text-zinc-400">
            <span>Generated by FlowDesk — Verified Freelance Workspace</span>
            <span>Document Ref: {invoice.id || invoice.invoiceNumber}</span>
          </div>
        </div>
      </div>
    );
  }
);

InvoiceDocument.displayName = 'InvoiceDocument';
