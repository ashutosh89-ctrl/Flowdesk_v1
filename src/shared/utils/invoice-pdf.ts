import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, UserProfile, InvoiceBranding } from '@/shared/types';
import { formatCurrency, getCurrencySymbol } from '@/shared/utils/currency';
import { convertAmountToWords } from '@/shared/utils/number-to-words';
import { FlowDeskStore } from '@/backend/store/storage-store';

/**
 * Safely loads an image URL into a Base64 data URL in browser environment.
 * Supports direct Base64 Data URLs, blob URLs, and remote URLs.
 */
async function loadImageDataUrl(url?: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  if (!url || typeof window === 'undefined') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // If already a Data URL (base64)
  if (trimmed.startsWith('data:image/')) {
    const isPng = trimmed.includes('image/png') || trimmed.includes('image/svg');
    return { dataUrl: trimmed, format: isPng ? 'PNG' : 'JPEG' };
  }

  try {
    const res = await fetch(trimmed, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const isPng = blob.type.includes('png') || blob.type.includes('svg');
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve({ dataUrl: reader.result, format: isPng ? 'PNG' : 'JPEG' });
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Resolves effective branding data from provided branding object or fallback store.
 */
function resolveBranding(branding?: InvoiceBranding | UserProfile | null) {
  let fallbackProfile: UserProfile | null = null;
  try {
    fallbackProfile = FlowDeskStore.getUserProfile();
  } catch {
    // ignore
  }

  const studioName =
    (branding as InvoiceBranding)?.businessName ||
    (branding as UserProfile)?.companyName ||
    (branding as any)?.name ||
    fallbackProfile?.companyName ||
    fallbackProfile?.name ||
    'FlowDesk Freelance Studio';

  const studioEmail =
    (branding as InvoiceBranding)?.email ||
    (branding as UserProfile)?.email ||
    fallbackProfile?.email ||
    '';

  const studioPhone =
    (branding as InvoiceBranding)?.phone ||
    (branding as UserProfile)?.phone ||
    fallbackProfile?.phone ||
    '';

  const studioAddress =
    (branding as UserProfile)?.address ||
    fallbackProfile?.address ||
    '';

  const studioTaxId =
    (branding as any)?.gstin ||
    (branding as any)?.taxId ||
    (branding as any)?.taxNumber ||
    '';

  const logoUrl =
    (branding as InvoiceBranding)?.logoUrl ||
    (branding as UserProfile)?.logoUrl ||
    fallbackProfile?.logoUrl ||
    '';

  const signatureUrl =
    (branding as InvoiceBranding)?.signatureUrl ||
    (branding as UserProfile)?.signatureUrl ||
    fallbackProfile?.signatureUrl ||
    '';

  const bankDetails = (branding as any)?.bankDetails || {};
  const bankName = bankDetails.bankName || (branding as any)?.bankName || '';
  const accountNumber = bankDetails.accountNumber || (branding as any)?.accountNumber || '';
  const ifscCode = bankDetails.ifscCode || bankDetails.swiftCode || (branding as any)?.ifscCode || '';
  const branchName = bankDetails.branchName || (branding as any)?.branchName || '';

  return {
    studioName,
    studioEmail,
    studioPhone,
    studioAddress,
    studioTaxId,
    logoUrl,
    signatureUrl,
    bankName,
    accountNumber,
    ifscCode,
    branchName,
  };
}

/**
 * Safe currency formatter for pure jsPDF vector rendering.
 * Standard jsPDF Helvetica font maps WinAnsiEncoding byte 0xB9 for Unicode ₹ (U+20B9)
 * which renders as ¹. This helper replaces ₹ with Rs. to ensure crisp, uncorrupted vector output.
 */
function formatVectorPdfCurrency(amount: number, currency: string = 'USD'): string {
  const formatted = formatCurrency(amount, currency);
  if (currency.toUpperCase() === 'INR' || formatted.includes('₹')) {
    return formatted.replace(/₹\s?/g, 'Rs. ');
  }
  return formatted;
}

/**
 * Generate a professional publication-ready PDF invoice and trigger download.
 * Embeds studio logo and signature with clean typography and layout.
 */
export async function generateInvoicePDF(
  invoice: Invoice,
  branding?: InvoiceBranding | UserProfile | null
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // Colors
  const primaryBlack = [15, 23, 42] as const; // Slate 900
  const mediumGray = [100, 116, 139] as const; // Slate 500
  const lightGray = [226, 232, 240] as const; // Slate 200
  const accentGreen = [16, 149, 114] as const; // Emerald 600

  // Resolve branding properties
  const {
    studioName,
    studioEmail,
    studioPhone,
    studioAddress,
    studioTaxId,
    logoUrl,
    signatureUrl,
    bankName,
    accountNumber,
    ifscCode,
    branchName,
  } = resolveBranding(branding);

  // Attempt to load images in parallel
  const [logoImage, signatureImage] = await Promise.all([
    logoUrl ? loadImageDataUrl(logoUrl) : Promise.resolve(null),
    signatureUrl ? loadImageDataUrl(signatureUrl) : Promise.resolve(null),
  ]);

  // ─── HEADER: Logo & Studio Info (Left) + INVOICE Details (Right) ───
  const headerStartY = yPos;
  let leftHeaderY = headerStartY;

  if (logoImage) {
    try {
      doc.addImage(logoImage.dataUrl, logoImage.format, margin, leftHeaderY, 36, 16);
      leftHeaderY += 20;
    } catch {
      // If addImage fails, continue with text header
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...primaryBlack);
  doc.text(studioName, margin, leftHeaderY + 4);
  leftHeaderY += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mediumGray);
  if (studioTaxId) {
    doc.text(`GSTIN / Tax ID: ${studioTaxId}`, margin, leftHeaderY);
    leftHeaderY += 4.5;
  }
  if (studioEmail) {
    doc.text(studioEmail, margin, leftHeaderY);
    leftHeaderY += 4.5;
  }
  if (studioPhone) {
    doc.text(studioPhone, margin, leftHeaderY);
    leftHeaderY += 4.5;
  }
  if (studioAddress) {
    doc.text(studioAddress, margin, leftHeaderY);
    leftHeaderY += 4.5;
  }

  // Right-aligned INVOICE Title & Meta
  let rightHeaderY = headerStartY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...primaryBlack);
  doc.text(studioTaxId ? 'TAX INVOICE' : 'INVOICE', pageWidth - margin, rightHeaderY + 6, { align: 'right' });
  rightHeaderY += 12;

  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryBlack);
  doc.text(invoice.invoiceNumber, pageWidth - margin, rightHeaderY + 2, { align: 'right' });
  rightHeaderY += 7;

  const statusText = (invoice.paymentStatus || invoice.status || 'draft').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  if (statusText === 'PAID') {
    doc.setTextColor(...accentGreen);
  } else if (statusText === 'OVERDUE') {
    doc.setTextColor(225, 29, 72); // Rose 600
  } else {
    doc.setTextColor(217, 119, 6); // Amber 600
  }
  doc.text(`STATUS: ${statusText}`, pageWidth - margin, rightHeaderY + 2, { align: 'right' });

  yPos = Math.max(leftHeaderY + 4, rightHeaderY + 12);

  // Divider line
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // ─── BILLING: From / Bill To (Two Columns) ───
  const colWidth = (contentWidth - 10) / 2;
  const leftColX = margin;
  const rightColX = margin + colWidth + 10;
  const billingStartY = yPos;

  // FROM Box
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(leftColX, billingStartY, colWidth, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...mediumGray);
  doc.text('ISSUED BY (FROM)', leftColX + 4, billingStartY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...primaryBlack);
  doc.text(studioName, leftColX + 4, billingStartY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mediumGray);
  doc.text(studioEmail || 'billing@freelancestudio.com', leftColX + 4, billingStartY + 15.5);
  if (studioPhone) {
    doc.text(studioPhone, leftColX + 4, billingStartY + 20);
  }

  // BILL TO Box
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(rightColX, billingStartY, colWidth, 26, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...mediumGray);
  doc.text('BILLED TO (CLIENT)', rightColX + 4, billingStartY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...primaryBlack);
  doc.text(invoice.clientName || 'Client Workspace', rightColX + 4, billingStartY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mediumGray);
  doc.text(invoice.clientEmail || 'client@example.com', rightColX + 4, billingStartY + 15.5);
  if (invoice.projectName) {
    doc.text(`Project: ${invoice.projectName}`, rightColX + 4, billingStartY + 20);
  }

  yPos = billingStartY + 30;

  // ─── DATES BAR ───
  doc.setFillColor(241, 245, 249); // Slate 100
  doc.roundedRect(margin, yPos, contentWidth, 10, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...mediumGray);
  doc.text('ISSUE DATE:', margin + 4, yPos + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryBlack);
  doc.text(invoice.issueDate || 'N/A', margin + 26, yPos + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mediumGray);
  doc.text('DUE DATE:', margin + 60, yPos + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryBlack);
  doc.text(invoice.dueDate || 'N/A', margin + 80, yPos + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mediumGray);
  doc.text('CURRENCY:', margin + 115, yPos + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryBlack);
  doc.text(invoice.currency || 'USD', margin + 137, yPos + 6.5);

  yPos += 14;

  // ─── LINE ITEMS TABLE ───
  const items = (invoice.items || []).map((item, idx) => [
    String(idx + 1),
    item.description || 'Deliverable Item',
    String(item.quantity || 1),
    formatVectorPdfCurrency(item.rate || 0, invoice.currency),
    formatVectorPdfCurrency(item.amount || (item.quantity || 1) * (item.rate || 0), invoice.currency),
  ]);

  autoTable(doc, {
    startY: yPos,
    margin: { left: margin, right: margin },
    head: [['Sr.', 'Description', 'Qty', 'Rate', 'Amount']],
    body: items,
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { halign: 'right', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  });

  // @ts-ignore
  yPos = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 6 : yPos + 40;

  // Check if totals section will overflow current page
  if (yPos > pageHeight - 75) {
    doc.addPage();
    yPos = margin;
  }

  // ─── TOTALS SECTION ───
  const totalsBoxWidth = 85;
  const totalsX = pageWidth - margin - totalsBoxWidth;
  const totalsLabelX = totalsX + 4;
  const totalsValueX = pageWidth - margin - 4;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(totalsX, yPos, totalsBoxWidth, 34 + (invoice.discount ? 6 : 0) + ((invoice.paidAmount || 0) > 0 ? 12 : 0), 2, 2, 'F');
  doc.setDrawColor(...lightGray);
  doc.roundedRect(totalsX, yPos, totalsBoxWidth, 34 + (invoice.discount ? 6 : 0) + ((invoice.paidAmount || 0) > 0 ? 12 : 0), 2, 2, 'S');

  let currentTotalY = yPos + 6;

  // Subtotal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...mediumGray);
  doc.text('Subtotal:', totalsLabelX, currentTotalY);
  doc.setTextColor(...primaryBlack);
  doc.text(formatVectorPdfCurrency(invoice.subtotal, invoice.currency), totalsValueX, currentTotalY, { align: 'right' });
  currentTotalY += 5.5;

  // Discount
  if (invoice.discount && invoice.discount > 0) {
    doc.setTextColor(...accentGreen);
    doc.text('Discount:', totalsLabelX, currentTotalY);
    doc.text(`-${formatVectorPdfCurrency(invoice.discount, invoice.currency)}`, totalsValueX, currentTotalY, { align: 'right' });
    currentTotalY += 5.5;
  }

  // Tax
  if (invoice.tax > 0 || (invoice.taxPercentage !== undefined && invoice.taxPercentage > 0)) {
    doc.setTextColor(...mediumGray);
    doc.text(`${invoice.taxName || 'Tax'} (${invoice.taxPercentage || 0}%):`, totalsLabelX, currentTotalY);
    doc.setTextColor(...primaryBlack);
    doc.text(formatVectorPdfCurrency(invoice.tax, invoice.currency), totalsValueX, currentTotalY, { align: 'right' });
    currentTotalY += 5.5;
  }

  // Divider
  doc.setDrawColor(...lightGray);
  doc.line(totalsLabelX, currentTotalY - 1, totalsValueX, currentTotalY - 1);
  currentTotalY += 3;

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryBlack);
  doc.text('Total Due:', totalsLabelX, currentTotalY);
  doc.text(formatVectorPdfCurrency(invoice.total, invoice.currency), totalsValueX, currentTotalY, { align: 'right' });
  currentTotalY += 6;

  // Paid / Balance
  const paidAmt = invoice.paidAmount || 0;
  if (paidAmt > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...accentGreen);
    doc.text('Amount Paid:', totalsLabelX, currentTotalY);
    doc.text(`-${formatVectorPdfCurrency(paidAmt, invoice.currency)}`, totalsValueX, currentTotalY, { align: 'right' });
    currentTotalY += 5.5;

    const remaining = invoice.remainingBalance ?? (invoice.total - paidAmt);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(217, 119, 6);
    doc.text('Balance Due:', totalsLabelX, currentTotalY);
    doc.text(formatVectorPdfCurrency(remaining, invoice.currency), totalsValueX, currentTotalY, { align: 'right' });
    currentTotalY += 6;
  }

  // ─── BANK DETAILS & INSTRUCTIONS (Left side of totals) ───
  let notesY = yPos;
  const notesWidth = contentWidth - totalsBoxWidth - 8;

  if (bankName || accountNumber) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, notesY, notesWidth, 22, 1.5, 1.5, 'F');
    doc.setDrawColor(...lightGray);
    doc.roundedRect(margin, notesY, notesWidth, 22, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...primaryBlack);
    doc.text('BANK TRANSFER DETAILS', margin + 3.5, notesY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mediumGray);
    let bankLineY = notesY + 9;
    if (bankName) {
      doc.text(`Bank: ${bankName}`, margin + 3.5, bankLineY);
      bankLineY += 4;
    }
    if (accountNumber) {
      doc.text(`A/C: ${accountNumber} ${ifscCode ? `| IFSC: ${ifscCode}` : ''}`, margin + 3.5, bankLineY);
      bankLineY += 4;
    }
    notesY += 26;
  }

  if (invoice.paymentInstructions && invoice.paymentInstructions.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...mediumGray);
    doc.text('PAYMENT INSTRUCTIONS', margin, notesY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mediumGray);
    const piLines = doc.splitTextToSize(invoice.paymentInstructions, notesWidth);
    doc.text(piLines.slice(0, 2), margin, notesY + 8);
    notesY += 14;
  }

  yPos = Math.max(currentTotalY + 8, notesY + 6);

  // ─── AMOUNT IN WORDS BANNER ───
  const amountWords = convertAmountToWords(invoice.total, invoice.currency);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, yPos, contentWidth, 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...primaryBlack);
  doc.text('AMOUNT IN WORDS:', margin + 4, yPos + 6);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...mediumGray);
  doc.text(amountWords, margin + 40, yPos + 6);
  yPos += 14;

  // ─── SIGNATURE BLOCK ───
  if (signatureImage) {
    if (yPos > pageHeight - 38) {
      doc.addPage();
      yPos = margin;
    }
    try {
      doc.addImage(signatureImage.dataUrl, signatureImage.format, margin, yPos, 36, 14);
      yPos += 16;
    } catch {
      // continue
    }
  }

  if (yPos > pageHeight - 25) {
    doc.addPage();
    yPos = margin;
  }

  doc.setDrawColor(...primaryBlack);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin + 45, yPos);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...primaryBlack);
  doc.text('Authorized Representative Sign/Seal', margin, yPos + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mediumGray);
  doc.text(`for ${studioName}`, margin, yPos + 8);

  // ─── FOOTER ───
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mediumGray);
    doc.text(`${studioName} • Thank you for your business.`, margin, pageHeight - 11);
    doc.text(
      `Generated by FlowDesk — Verified Freelance Settlement`,
      pageWidth / 2,
      pageHeight - 11,
      { align: 'center' }
    );
    doc.text(
      `Invoice ${invoice.invoiceNumber} • Page ${i} of ${pageCount}`,
      pageWidth - margin,
      pageHeight - 11,
      { align: 'right' }
    );
  }

  // Save the PDF
  const filename = `FlowDesk-Invoice-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
  doc.save(filename);
}

/**
 * Print invoice as a clean, publication-ready A4 document without UI screenshot artifacts.
 * Renders high-resolution vector HTML into a dedicated print frame.
 */
export function printInvoiceDocument(
  invoice: Invoice,
  branding?: InvoiceBranding | UserProfile | null
): void {
  if (typeof window === 'undefined') return;

  const {
    studioName,
    studioEmail,
    studioPhone,
    studioAddress,
    studioTaxId,
    logoUrl,
    signatureUrl,
    bankName,
    accountNumber,
    ifscCode,
    branchName,
  } = resolveBranding(branding);

  const statusText = (invoice.paymentStatus || invoice.status || 'draft').toUpperCase();
  const statusBg =
    statusText === 'PAID'
      ? '#dcfce7'
      : statusText === 'OVERDUE'
      ? '#ffe4e6'
      : '#fef3c7';
  const statusColor =
    statusText === 'PAID'
      ? '#15803d'
      : statusText === 'OVERDUE'
      ? '#be123c'
      : '#b45309';

  const amountWords = convertAmountToWords(invoice.total, invoice.currency);

  const lineItemsHtml = (invoice.items || [])
    .map(
      (item, idx) => `
      <tr style="border-bottom: 1px solid #e4e4e7; background-color: ${idx % 2 === 0 ? '#ffffff' : '#fafafa'};">
        <td style="padding: 10px 14px; font-size: 11px; color: #71717a; text-align: center; font-family: monospace;">${idx + 1}</td>
        <td style="padding: 10px 14px; font-size: 12px; color: #18181b; font-weight: 500;">${item.description || 'Deliverable Item'}</td>
        <td style="padding: 10px 14px; font-size: 12px; color: #52525b; text-align: right; font-family: monospace;">${item.quantity || 1}</td>
        <td style="padding: 10px 14px; font-size: 12px; color: #52525b; text-align: right; font-family: monospace;">${formatCurrency(item.rate || 0, invoice.currency)}</td>
        <td style="padding: 10px 14px; font-size: 12px; color: #09090b; text-align: right; font-family: monospace; font-weight: 700;">${formatCurrency(item.amount || (item.quantity || 1) * (item.rate || 0), invoice.currency)}</td>
      </tr>
    `
    )
    .join('');

  const printHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Invoice - ${invoice.invoiceNumber}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 16mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #09090b;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          line-height: 1.5;
        }
        .invoice-sheet {
          max-width: 800px;
          margin: 0 auto;
          padding: 24px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 18px;
          border-bottom: 1.5px solid #e4e4e7;
          margin-bottom: 18px;
        }
        .studio-logo {
          max-height: 52px;
          max-width: 180px;
          object-fit: contain;
          margin-bottom: 8px;
          display: block;
        }
        .studio-title {
          font-size: 18px;
          font-weight: 800;
          color: #09090b;
          letter-spacing: -0.2px;
        }
        .studio-meta {
          font-size: 11px;
          color: #71717a;
          margin-top: 2px;
        }
        .invoice-title {
          font-size: 24px;
          font-weight: 900;
          color: #09090b;
          letter-spacing: -0.5px;
          text-align: right;
        }
        .invoice-number {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 13px;
          font-weight: 700;
          color: #18181b;
          text-align: right;
          margin-top: 2px;
        }
        .status-badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 6px;
          background: ${statusBg};
          color: ${statusColor};
          margin-top: 6px;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 14px;
        }
        .card-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          margin-bottom: 4px;
        }
        .card-name {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
        }
        .card-sub {
          font-size: 11px;
          color: #64748b;
        }
        .dates-bar {
          background: #f1f5f9;
          border-radius: 6px;
          padding: 8px 14px;
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 18px;
        }
        .dates-bar strong {
          color: #0f172a;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 18px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 14px;
          text-align: left;
          border-bottom: 1.5px solid #cbd5e1;
        }
        .totals-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 18px;
        }
        .instructions-box {
          flex: 1;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 11px;
        }
        .totals-card {
          width: 280px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px;
          font-size: 12px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          color: #64748b;
        }
        .totals-row.bold {
          color: #0f172a;
          font-weight: 700;
        }
        .totals-row.grand {
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          border-top: 1.5px solid #cbd5e1;
          padding-top: 8px;
          margin-top: 8px;
        }
        .words-banner {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 11px;
          margin-bottom: 18px;
        }
        .signature-section {
          margin-top: 18px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .signature-img {
          max-height: 48px;
          max-width: 160px;
          object-fit: contain;
          margin-bottom: 6px;
          display: block;
        }
        .signature-line {
          width: 180px;
          border-top: 1.5px solid #0f172a;
          margin-bottom: 4px;
        }
        .footer {
          border-top: 1px solid #e2e8f0;
          padding-top: 12px;
          margin-top: 24px;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="invoice-sheet">
        <!-- Header -->
        <div class="header">
          <div>
            ${logoUrl ? `<img src="${logoUrl}" class="studio-logo" alt="Studio Logo" />` : ''}
            <div class="studio-title">${studioName}</div>
            ${studioTaxId ? `<div class="studio-meta">GSTIN / Tax ID: <strong>${studioTaxId}</strong></div>` : ''}
            ${studioEmail ? `<div class="studio-meta">${studioEmail}</div>` : ''}
            ${studioPhone ? `<div class="studio-meta">${studioPhone}</div>` : ''}
            ${studioAddress ? `<div class="studio-meta">${studioAddress}</div>` : ''}
          </div>
          <div style="text-align: right;">
            <div class="invoice-title">${studioTaxId ? 'TAX INVOICE' : 'INVOICE'}</div>
            <div class="invoice-number">${invoice.invoiceNumber}</div>
            <div class="status-badge">${statusText}</div>
          </div>
        </div>

        <!-- Billing Grid -->
        <div class="grid-2">
          <div class="card">
            <div class="card-label">Issued By</div>
            <div class="card-name">${studioName}</div>
            <div class="card-sub">${studioEmail}</div>
            ${studioPhone ? `<div class="card-sub">${studioPhone}</div>` : ''}
          </div>
          <div class="card">
            <div class="card-label">Billed To (Recipient)</div>
            <div class="card-name">${invoice.clientName || 'Client Workspace'}</div>
            <div class="card-sub">${invoice.clientEmail || ''}</div>
            ${invoice.projectName ? `<div class="card-sub" style="margin-top: 4px; font-weight: 600;">Project: ${invoice.projectName}</div>` : ''}
          </div>
        </div>

        <!-- Dates Bar -->
        <div class="dates-bar">
          <div>Issue Date: <strong>${invoice.issueDate || 'N/A'}</strong></div>
          <div>Due Date: <strong>${invoice.dueDate || 'N/A'}</strong></div>
          <div>Currency: <strong>${invoice.currency || 'USD'}</strong></div>
        </div>

        <!-- Table -->
        <table>
          <thead>
            <tr>
              <th style="width: 8%; text-align: center;">Sr.</th>
              <th style="width: 45%;">Item / Description</th>
              <th style="text-align: right; width: 12%;">Qty</th>
              <th style="text-align: right; width: 15%;">Rate (${getCurrencySymbol(invoice.currency)})</th>
              <th style="text-align: right; width: 20%;">Total (${getCurrencySymbol(invoice.currency)})</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
          </tbody>
        </table>

        <!-- Totals & Notes -->
        <div class="totals-section">
          <div class="instructions-box">
            ${
              bankName || accountNumber
                ? `<div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">Bank Transfer Details</div>
                   <div style="color: #475569; font-size: 11px;">
                     ${bankName ? `<div>Bank: <strong>${bankName}</strong></div>` : ''}
                     ${accountNumber ? `<div>A/C: <strong style="font-family: monospace;">${accountNumber}</strong> ${ifscCode ? `| IFSC: <strong style="font-family: monospace;">${ifscCode}</strong>` : ''}</div>` : ''}
                     ${branchName ? `<div>Branch: ${branchName}</div>` : ''}
                   </div>`
                : ''
            }
            ${
              invoice.paymentInstructions
                ? `<div style="font-weight: 700; color: #0f172a; margin-top: 6px; margin-bottom: 2px;">Payment Instructions</div>
                   <div style="color: #475569; white-space: pre-line;">${invoice.paymentInstructions}</div>`
                : ''
            }
          </div>

          <div class="totals-card">
            <div class="totals-row">
              <span>Subtotal (Pre-Tax):</span>
              <span style="font-family: monospace; font-weight: 600; color: #0f172a;">${formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            ${
              invoice.discount && invoice.discount > 0
                ? `<div class="totals-row" style="color: #16a34a;">
                     <span>Discount:</span>
                     <span style="font-family: monospace; font-weight: 600;">-${formatCurrency(invoice.discount, invoice.currency)}</span>
                   </div>`
                : ''
            }
            ${
              invoice.tax > 0 || (invoice.taxPercentage !== undefined && invoice.taxPercentage > 0)
                ? `<div class="totals-row">
                     <span>${invoice.taxName || 'Tax'} (${invoice.taxPercentage || 0}%):</span>
                     <span style="font-family: monospace; font-weight: 600; color: #0f172a;">${formatCurrency(invoice.tax, invoice.currency)}</span>
                   </div>`
                : ''
            }
            <div class="totals-row grand">
              <span>Grand Total:</span>
              <span style="font-family: monospace;">${formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
            ${
              (invoice.paidAmount || 0) > 0
                ? `<div class="totals-row" style="color: #16a34a; font-size: 11px; margin-top: 4px;">
                     <span>Amount Paid:</span>
                     <span style="font-family: monospace;">-${formatCurrency(invoice.paidAmount || 0, invoice.currency)}</span>
                   </div>
                   <div class="totals-row bold" style="color: #b45309; font-size: 11px;">
                     <span>Balance Due:</span>
                     <span style="font-family: monospace;">${formatCurrency(invoice.remainingBalance ?? (invoice.total - (invoice.paidAmount || 0)), invoice.currency)}</span>
                   </div>`
                : ''
            }
          </div>
        </div>

        <!-- Amount in Words -->
        <div class="words-banner">
          <strong>AMOUNT IN WORDS:</strong> <em>${amountWords}</em>
        </div>

        <!-- Signature & Footer -->
        <div class="signature-section">
          <div>
            <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 2px;">TERMS & CONDITIONS</div>
            <div style="font-size: 10px; color: #71717a;">
              1. Payment is due within standard agreed terms.<br />
              2. Please quote invoice number on payment transfers.
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 600; color: #09090b; margin-bottom: 4px;">for ${studioName}</div>
            ${signatureUrl ? `<img src="${signatureUrl}" class="signature-img" style="margin-left: auto;" alt="Authorized Signature" />` : ''}
            <div class="signature-line" style="margin-left: auto;"></div>
            <div style="font-size: 10px; font-weight: 500; color: #64748b;">Authorized Representative Sign/Seal</div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <div>${studioName} • Thank you for your business.</div>
          <div>Generated by FlowDesk</div>
        </div>
      </div>
    </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(printHtml);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 350);
}
