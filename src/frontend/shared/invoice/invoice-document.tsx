'use client';

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { Invoice, UserProfile, InvoiceBranding } from '@/shared/types';
import { formatCurrency, getCurrencySymbol } from '@/shared/utils/currency';
import { convertAmountToWords } from '@/shared/utils/number-to-words';
import { Building2, Landmark, QrCode } from 'lucide-react';

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
  amount,
  payeeName,
  invoiceNumber,
}: {
  upiId?: string;
  amount: number;
  payeeName: string;
  invoiceNumber: string;
}) {
  if (!upiId) {
    return (
      <div className="w-24 h-24 rounded-lg bg-zinc-100 border border-zinc-200 flex flex-col items-center justify-center p-2 text-center">
        <QrCode className="w-8 h-8 text-zinc-400 mb-1" />
        <span className="text-[9px] text-zinc-500 font-medium leading-tight">Pay via UPI / Link</span>
      </div>
    );
  }

  // Construct UPI URI
  const encodedName = encodeURIComponent(payeeName.slice(0, 25));
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodedName}&am=${amount.toFixed(2)}&cu=INR&tn=Invoice%20${encodeURIComponent(invoiceNumber)}`;
  // Use quickchart or clean QR SVG fallback
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=4&data=${encodeURIComponent(upiUri)}`;

  return (
    <div className="flex flex-col items-center">
      <div className="w-24 h-24 rounded-lg bg-white border border-zinc-300 p-1 shadow-sm overflow-hidden flex items-center justify-center">
        <img
          src={qrUrl}
          alt="UPI QR Code"
          className="w-full h-full object-contain"
          crossOrigin="anonymous"
          onError={(e) => {
            // If image load fails (offline), fallback gracefully to icon
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>
      <span className="text-[9px] font-bold text-zinc-600 mt-1 uppercase tracking-wider">Pay via UPI</span>
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

    // Bank Details resolution from invoice or branding
    const bankDetails = (branding as any)?.bankDetails || {};
    const bankName = bankDetails.bankName || (branding as any)?.bankName || '';
    const accountNumber = bankDetails.accountNumber || (branding as any)?.accountNumber || '';
    const ifscCode = bankDetails.ifscCode || bankDetails.swiftCode || (branding as any)?.ifscCode || '';
    const branchName = bankDetails.branchName || (branding as any)?.branchName || '';
    const upiId = bankDetails.upiId || (branding as any)?.upiId || '';

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
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={studioName}
                  crossOrigin="anonymous"
                  className="h-14 w-auto max-w-[140px] object-contain rounded-lg shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Building2 className="w-6 h-6 text-zinc-100" />
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
          <div className="pt-2 pb-6 border-t-2 border-zinc-300 grid grid-cols-1 sm:grid-cols-2 gap-8 items-start">
            {/* Left: Bank Transfer Details + UPI QR */}
            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-zinc-900 font-bold tracking-tight uppercase text-[11px]">
                  <Landmark className="w-3.5 h-3.5 text-zinc-700" />
                  <span>BANK TRANSFER DETAILS</span>
                </div>
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-1 text-zinc-700 text-[11px]">
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

              {/* UPI Payment Block */}
              {(currency.toUpperCase() === 'INR' || upiId) && (
                <div className="flex items-center gap-4">
                  <UPIPaymentQR
                    upiId={upiId}
                    amount={total}
                    payeeName={studioName}
                    invoiceNumber={invoice.invoiceNumber}
                  />
                  <div className="text-[11px] text-zinc-500 space-y-0.5">
                    <p className="font-semibold text-zinc-800">Scan & Pay</p>
                    <p>Use any UPI app (GPay, PhonePe, Paytm, BHIM) to settle instantly.</p>
                  </div>
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
                {signatureUrl ? (
                  <img
                    src={signatureUrl}
                    alt="Authorized Signature"
                    crossOrigin="anonymous"
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
