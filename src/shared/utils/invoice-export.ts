/**
 * FlowDesk Modern Invoice Export Engine (Rebuilt from Scratch)
 *
 * Provides deterministic, high-resolution rasterization and vector export
 * for FlowDesk invoices without any external DOM-cloning or html2canvas dependencies.
 *
 * Architecture:
 * 1. Canonical Invoice Data Model & Totals Calculation
 * 2. Dedicated A4 2D Canvas Rasterizer (2x scale, 1600px width)
 * 3. Independent High-Res PNG Exporter (lossless RGBA)
 * 4. Independent Crisp JPEG Exporter (explicit #ffffff background, 0.95 quality)
 * 5. Vector PDF Export (jsPDF + autoTable engine)
 * 6. Vector Print Pipeline
 * 7. In-flight Export Mutex to prevent duplicate downloads
 */

import { Invoice, UserProfile, InvoiceBranding, BankDetails } from '@/shared/types';
import { calculateInvoiceTotals } from '@/shared/utils/invoice-calculations';
import { formatCurrency, getCurrencySymbol } from '@/shared/utils/currency';
import { generateQrMatrix } from '@/frontend/shared/ui/qr-code';
import { printInvoiceDocument as originalPrint, generateInvoicePDF as vectorGeneratePDF } from './invoice-pdf';

/**
 * Mutex set tracking active exports by invoiceNumber to prevent duplicate simultaneous clicks.
 */
const activeExports = new Set<string>();

/**
 * Sanitizes an invoice number for safe cross-platform file naming.
 * Example: 'INV/2026/001' -> 'INV_2026_001'
 */
export function sanitizeFilename(invoiceNumber: string, ext: string = 'pdf'): string {
  const clean = (invoiceNumber || 'Invoice').replace(/[/\\?%*:|"<>]/g, '_').trim();
  return `FlowDesk-Invoice-${clean}.${ext}`;
}

/**
 * Helper to wrap text into multiple lines given a max width and 2D canvas context.
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Helper to resolve branding details safely from either InvoiceBranding, UserProfile, or defaults.
 */
function resolveBrandingData(branding?: InvoiceBranding | UserProfile | null) {
  const b = branding as any || {};
  return {
    businessName: b.businessName || b.companyName || b.name || 'FlowDesk Studio',
    freelancerName: b.freelancerName || b.name || '',
    email: b.email || '',
    phone: b.phone || '',
    address: b.address || '',
    country: b.country || '',
    bankDetails: (b.bankDetails || {}) as BankDetails,
    upiId: b.upiId || (b.bankDetails && b.bankDetails.upiId) || '',
    razorpayPaymentLink: b.razorpayPaymentLink || '',
  };
}

/**
 * Dedicated high-resolution 2D Canvas rasterizer for FlowDesk Invoices.
 * Produces a pixel-perfect, deterministic A4 document canvas at 2x resolution (1600px width).
 */
export async function renderInvoiceToCanvas(
  invoice: Invoice,
  branding?: InvoiceBranding | UserProfile | null
): Promise<HTMLCanvasElement> {
  if (typeof document === 'undefined') {
    throw new Error('renderInvoiceToCanvas requires a browser DOM environment.');
  }

  const effectiveBranding = resolveBrandingData(branding);
  const currency = invoice.currency || 'USD';
  const symbol = getCurrencySymbol(currency);

  // Canonical calculations
  const totals = calculateInvoiceTotals({
    items: invoice.items || [],
    taxPercentage: invoice.taxPercentage,
    discount: invoice.discount,
  });

  const subtotal = totals.subtotal;
  const taxAmount = totals.taxAmount;
  const total = totals.total;
  const paidAmount = Number(invoice.paidAmount) || 0;
  const balanceDue = Math.max(0, Math.round((total - paidAmount) * 100) / 100);

  // Effective payment methods
  const methodsConfig = invoice.paymentMethods || {
    bankTransferEnabled: true,
    upiEnabled: Boolean(
      invoice.upiId ||
      invoice.upiQrCodeUrl ||
      effectiveBranding.upiId ||
      (effectiveBranding as any).upiQrCodeUrl
    ),
    razorpayLinkEnabled: Boolean(invoice.razorpayPaymentLink || effectiveBranding.razorpayPaymentLink),
  };

  const bankDetails: BankDetails = {
    accountHolderName: invoice.bankDetails?.accountHolderName || effectiveBranding.bankDetails?.accountHolderName || '',
    bankName: invoice.bankDetails?.bankName || effectiveBranding.bankDetails?.bankName || '',
    accountNumber: invoice.bankDetails?.accountNumber || effectiveBranding.bankDetails?.accountNumber || '',
    ifscCode: invoice.bankDetails?.ifscCode || effectiveBranding.bankDetails?.ifscCode || '',
    branchName: invoice.bankDetails?.branchName || effectiveBranding.bankDetails?.branchName || '',
  };

  const upiId = invoice.upiId || effectiveBranding.upiId || '';
  const upiQrCodeUrl = invoice.upiQrCodeUrl || invoice.paymentMethods?.upiQrCodeUrl || (effectiveBranding as any).upiQrCodeUrl || '';
  const razorpayLink = invoice.razorpayPaymentLink || effectiveBranding.razorpayPaymentLink || '';

  // Determine canvas dimensions
  const scale = 2;
  const width = 800 * scale; // 1600px
  const margin = 48 * scale; // 96px
  const contentWidth = width - margin * 2; // 1408px

  // Rough height pre-calculation
  const itemsCount = Math.max(1, (invoice.items || []).length);
  const baseContentHeight =
    320 + // Header & Metadata
    160 + // Bill to & Dates
    80 + // Table header
    itemsCount * 70 + // Line items
    260 + // Financial summary
    380 + // Payment instructions & QR
    160 + // Notes & terms
    100; // Footer

  const minA4Height = 1130 * scale; // 2260px
  const height = Math.max(minA4Height, (baseContentHeight + 100) * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to obtain 2D canvas rendering context.');
  }

  // 1. Solid pure white background (guarantees JPEG never produces transparent/black pixels)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Subtle top accent bar
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, width, 8 * scale);

  let curY = margin;

  // 2. Header Section: Studio Branding & Document Title
  ctx.fillStyle = '#09090b';
  ctx.font = `bold ${28 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(effectiveBranding.businessName, margin, curY + 28 * scale);

  // Freelancer details
  ctx.fillStyle = '#52525b';
  ctx.font = `${14 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  let brandY = curY + 48 * scale;
  if (effectiveBranding.freelancerName && effectiveBranding.freelancerName !== effectiveBranding.businessName) {
    ctx.fillText(effectiveBranding.freelancerName, margin, brandY);
    brandY += 20 * scale;
  }
  if (effectiveBranding.email) {
    ctx.fillText(effectiveBranding.email, margin, brandY);
    brandY += 20 * scale;
  }
  if (effectiveBranding.phone) {
    ctx.fillText(effectiveBranding.phone, margin, brandY);
    brandY += 20 * scale;
  }
  if (effectiveBranding.address) {
    ctx.fillText(effectiveBranding.address, margin, brandY);
    brandY += 20 * scale;
  }

  // Right-aligned "INVOICE" Title & Status Badge
  const rightX = width - margin;
  ctx.textAlign = 'right';

  ctx.fillStyle = '#09090b';
  ctx.font = `bold ${36 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText('INVOICE', rightX, curY + 36 * scale);

  // Invoice Number
  ctx.fillStyle = '#27272a';
  ctx.font = `bold ${16 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(`#${invoice.invoiceNumber || 'INV-001'}`, rightX, curY + 64 * scale);

  // Status Badge
  const statusStr = (invoice.status || invoice.paymentStatus || 'pending').toUpperCase();
  let badgeBg = '#f4f4f5';
  let badgeTextColor = '#52525b';

  if (statusStr === 'PAID') {
    badgeBg = '#dcfce7';
    badgeTextColor = '#15803d';
  } else if (statusStr === 'OVERDUE') {
    badgeBg = '#fee2e2';
    badgeTextColor = '#b91c1c';
  } else if (statusStr === 'PARTIALLY_PAID') {
    badgeBg = '#fef3c7';
    badgeTextColor = '#b45309';
  } else if (statusStr === 'PENDING' || statusStr === 'SENT') {
    badgeBg = '#e0f2fe';
    badgeTextColor = '#0369a1';
  }

  const badgeText = statusStr.replace('_', ' ');
  ctx.font = `bold ${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const badgeMetrics = ctx.measureText(badgeText);
  const badgeW = badgeMetrics.width + 20 * scale;
  const badgeH = 22 * scale;
  const badgeX = rightX - badgeW;
  const badgeY = curY + 76 * scale;

  ctx.fillStyle = badgeBg;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6 * scale);
  ctx.fill();

  ctx.fillStyle = badgeTextColor;
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 15 * scale);

  // Reset alignment
  ctx.textAlign = 'left';
  curY = Math.max(brandY, badgeY + badgeH + 20 * scale) + 24 * scale;

  // Divider
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(margin, curY);
  ctx.lineTo(width - margin, curY);
  ctx.stroke();

  curY += 24 * scale;

  // 3. Bill To & Dates Section
  // Left: Bill To
  ctx.fillStyle = '#71717a';
  ctx.font = `bold ${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText('BILLED TO', margin, curY);

  ctx.fillStyle = '#09090b';
  ctx.font = `bold ${16 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(invoice.clientName || 'Valued Client', margin, curY + 22 * scale);

  ctx.fillStyle = '#52525b';
  ctx.font = `${13 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  let clientDetailsY = curY + 42 * scale;
  if (invoice.clientEmail) {
    ctx.fillText(invoice.clientEmail, margin, clientDetailsY);
    clientDetailsY += 18 * scale;
  }
  if (invoice.projectName) {
    ctx.fillStyle = '#71717a';
    ctx.fillText(`Project: ${invoice.projectName}`, margin, clientDetailsY);
    clientDetailsY += 18 * scale;
  }

  // Right: Dates block
  const dateColX = width - margin - 220 * scale;
  ctx.fillStyle = '#71717a';
  ctx.font = `bold ${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText('ISSUE DATE', dateColX, curY);
  ctx.fillText('DUE DATE', dateColX + 110 * scale, curY);

  ctx.fillStyle = '#18181b';
  ctx.font = `${13 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(invoice.issueDate || '—', dateColX, curY + 22 * scale);

  ctx.fillStyle = invoice.status === 'overdue' ? '#dc2626' : '#18181b';
  ctx.font = `bold ${13 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(invoice.dueDate || '—', dateColX + 110 * scale, curY + 22 * scale);

  curY = Math.max(clientDetailsY, curY + 44 * scale) + 24 * scale;

  // 4. Line Items Table
  // Header Row
  const tableTop = curY;
  const colIdx = margin;
  const colDesc = margin + 44 * scale;
  const colQty = width - margin - 320 * scale;
  const colRate = width - margin - 200 * scale;
  const colAmount = width - margin;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(margin, tableTop, contentWidth, 32 * scale);

  ctx.strokeStyle = '#e2e8f0';
  ctx.strokeRect(margin, tableTop, contentWidth, 32 * scale);

  ctx.fillStyle = '#64748b';
  ctx.font = `bold ${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('#', colIdx + 12 * scale, tableTop + 20 * scale);
  ctx.fillText('DESCRIPTION', colDesc, tableTop + 20 * scale);

  ctx.textAlign = 'right';
  ctx.fillText('QTY', colQty + 30 * scale, tableTop + 20 * scale);
  ctx.fillText('RATE', colRate + 60 * scale, tableTop + 20 * scale);
  ctx.fillText('AMOUNT', colAmount - 12 * scale, tableTop + 20 * scale);

  curY = tableTop + 32 * scale;

  // Table Body Rows
  const items = invoice.items && invoice.items.length > 0 ? invoice.items : [{ description: 'Professional Services', quantity: 1, rate: total, amount: total }];

  ctx.textAlign = 'left';
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const itemQty = Number(it.quantity) || 1;
    const itemRate = Number(it.rate) || 0;
    const itemAmount = Math.round(itemQty * itemRate * 100) / 100;

    // Check line wrapping for description
    ctx.font = `${13 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const descLines = wrapCanvasText(ctx, it.description || 'Service', (colQty - colDesc) - 16 * scale);
    const rowH = Math.max(40 * scale, (descLines.length * 18 + 22) * scale);

    // Row alternating background
    if (idx % 2 === 1) {
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(margin, curY, contentWidth, rowH);
    }

    // Row bottom border
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(margin, curY + rowH);
    ctx.lineTo(width - margin, curY + rowH);
    ctx.stroke();

    // Index
    ctx.fillStyle = '#94a3b8';
    ctx.font = `${12 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(String(idx + 1), colIdx + 12 * scale, curY + 22 * scale);

    // Description
    ctx.fillStyle = '#1e293b';
    ctx.font = `${13 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    let lineY = curY + 22 * scale;
    for (const dLine of descLines) {
      ctx.fillText(dLine, colDesc, lineY);
      lineY += 18 * scale;
    }

    // Numbers (Right-aligned)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#334155';
    ctx.font = `${13 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(String(itemQty), colQty + 30 * scale, curY + 22 * scale);
    ctx.fillText(formatCurrency(itemRate, currency), colRate + 60 * scale, curY + 22 * scale);

    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${13 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(formatCurrency(itemAmount, currency), colAmount - 12 * scale, curY + 22 * scale);

    ctx.textAlign = 'left';
    curY += rowH;
  }

  curY += 20 * scale;

  // 5. Financial Summary Block (Right side)
  const summaryW = 340 * scale;
  const summaryX = width - margin - summaryW;
  let sumY = curY;

  const drawSummaryRow = (label: string, value: string, isBold: boolean = false, isAccent: boolean = false) => {
    ctx.fillStyle = isAccent ? '#09090b' : '#64748b';
    ctx.font = `${isBold ? 'bold ' : ''}${13 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(label, summaryX, sumY);

    ctx.textAlign = 'right';
    ctx.fillStyle = isAccent ? '#09090b' : '#1e293b';
    ctx.fillText(value, width - margin, sumY);
    sumY += 22 * scale;
  };

  drawSummaryRow('Subtotal', formatCurrency(subtotal, currency));

  if (totals.discount > 0) {
    drawSummaryRow('Discount', `-${formatCurrency(totals.discount, currency)}`);
  }

  if (totals.taxAmount > 0) {
    const taxLabel = `${invoice.taxName || 'Tax'} (${totals.taxPercentage}%)`;
    drawSummaryRow(taxLabel, `+${formatCurrency(taxAmount, currency)}`);
  }

  // Divider
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(summaryX, sumY);
  ctx.lineTo(width - margin, sumY);
  ctx.stroke();
  sumY += 16 * scale;

  // Grand Total Box
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(summaryX - 10 * scale, sumY - 14 * scale, summaryW + 10 * scale, 38 * scale, 6 * scale);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  ctx.fillStyle = '#09090b';
  ctx.font = `bold ${16 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('Total', summaryX, sumY + 12 * scale);

  ctx.textAlign = 'right';
  ctx.fillText(formatCurrency(total, currency), width - margin, sumY + 12 * scale);
  sumY += 42 * scale;

  // Paid & Balance Due
  if (paidAmount > 0) {
    drawSummaryRow('Amount Paid', formatCurrency(paidAmount, currency));
  }

  // Balance Due Callout
  ctx.fillStyle = balanceDue <= 0 ? '#f0fdf4' : '#fff7ed';
  ctx.beginPath();
  ctx.roundRect(summaryX - 10 * scale, sumY - 14 * scale, summaryW + 10 * scale, 34 * scale, 6 * scale);
  ctx.fill();
  ctx.strokeStyle = balanceDue <= 0 ? '#bbf7d0' : '#fed7aa';
  ctx.stroke();

  ctx.fillStyle = balanceDue <= 0 ? '#15803d' : '#c2410c';
  ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('Balance Due', summaryX, sumY + 8 * scale);

  ctx.textAlign = 'right';
  ctx.fillText(formatCurrency(balanceDue, currency), width - margin, sumY + 8 * scale);
  sumY += 40 * scale;

  // 6. Dual Payment Methods Section (Left side under table)
  let payY = curY;
  const payBoxW = contentWidth - summaryW - 40 * scale;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#09090b';
  ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText('PAYMENT INSTRUCTIONS', margin, payY);
  payY += 16 * scale;

  let hasInstructions = false;

  // Method 1: Bank Transfer
  const hasBank =
    methodsConfig.bankTransferEnabled !== false &&
    Boolean(bankDetails.bankName || bankDetails.accountNumber);

  if (hasBank) {
    hasInstructions = true;
    ctx.fillStyle = '#475569';
    ctx.font = `bold ${12 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText('Bank Transfer (NEFT / RTGS / IMPS)', margin, payY);
    payY += 16 * scale;

    ctx.font = `${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = '#64748b';

    if (bankDetails.accountHolderName) {
      ctx.fillText(`Account Name: ${bankDetails.accountHolderName}`, margin, payY);
      payY += 15 * scale;
    }
    if (bankDetails.bankName) {
      ctx.fillText(`Bank: ${bankDetails.bankName}`, margin, payY);
      payY += 15 * scale;
    }
    if (bankDetails.accountNumber) {
      ctx.fillText(`Account Number: ${bankDetails.accountNumber}`, margin, payY);
      payY += 15 * scale;
    }
    if (bankDetails.ifscCode) {
      ctx.fillText(`IFSC Code: ${bankDetails.ifscCode}`, margin, payY);
      payY += 15 * scale;
    }
    if (bankDetails.branchName) {
      ctx.fillText(`Branch: ${bankDetails.branchName}`, margin, payY);
      payY += 15 * scale;
    }
    payY += 8 * scale;
  }

  // Method 2: UPI ID and Crisp Vector QR Code
  const hasUpi = methodsConfig.upiEnabled !== false && Boolean(upiId || upiQrCodeUrl);
  if (hasUpi) {
    hasInstructions = true;
    ctx.fillStyle = '#475569';
    ctx.font = `bold ${12 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(upiQrCodeUrl && !upiId ? 'Scan & Pay QR' : 'UPI / Instant Mobile Payment', margin, payY);
    payY += 16 * scale;

    if (upiId) {
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold ${12 * scale}px monospace`;
      ctx.fillText(upiId, margin, payY);
      payY += 18 * scale;
    }

    const qrPixelSize = 90 * scale;
    const qrX = margin;
    const qrY = payY;

    // QR white frame
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX - 4 * scale, qrY - 4 * scale, qrPixelSize + 8 * scale, qrPixelSize + 8 * scale);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1 * scale;
    ctx.strokeRect(qrX - 4 * scale, qrY - 4 * scale, qrPixelSize + 8 * scale, qrPixelSize + 8 * scale);

    let qrRendered = false;
    if (upiQrCodeUrl) {
      try {
        const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = upiQrCodeUrl;
        });
        ctx.drawImage(qrImg, qrX, qrY, qrPixelSize, qrPixelSize);
        qrRendered = true;
      } catch {
        // Fallback to dynamic UPI QR code
      }
    }

    if (!qrRendered && upiId) {
      // Draw 2D QR Code Matrix
      try {
        const qrValue = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(effectiveBranding.businessName || 'FlowDesk')}&am=${balanceDue}&cu=${currency}`;
        const matrix = generateQrMatrix(qrValue, 25);
        const moduleCount = matrix.length || 25;
        const cellSize = qrPixelSize / moduleCount;

        // Render modules
        ctx.fillStyle = '#09090b';
        for (let r = 0; r < moduleCount; r++) {
          for (let c = 0; c < moduleCount; c++) {
            if (matrix[r][c]) {
              ctx.fillRect(qrX + c * cellSize, qrY + r * cellSize, cellSize + 0.3, cellSize + 0.3);
            }
          }
        }
        qrRendered = true;
      } catch {
        // Non-fatal QR draw
      }
    }

    ctx.fillStyle = '#64748b';
    ctx.font = `${10 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(upiQrCodeUrl ? 'Scan with any UPI / Banking App' : 'Scan with any UPI App', qrX + qrPixelSize + 12 * scale, qrY + qrPixelSize / 2);

    payY += qrPixelSize + 14 * scale;
  }

  // Method 3: Razorpay Payment Link
  const hasRazorpay =
    methodsConfig.razorpayLinkEnabled !== false &&
    Boolean(razorpayLink);

  if (hasRazorpay) {
    hasInstructions = true;
    ctx.fillStyle = '#475569';
    ctx.font = `bold ${12 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText('Pay Online via Razorpay', margin, payY);
    payY += 16 * scale;

    ctx.fillStyle = '#2563eb';
    ctx.font = `${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(razorpayLink, margin, payY);
    payY += 15 * scale;

    ctx.fillStyle = '#71717a';
    ctx.font = `${10 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText('Official Razorpay payment gateway link provided by service provider.', margin, payY);
    payY += 18 * scale;
  }

  if (invoice.paymentInstructions) {
    hasInstructions = true;
    ctx.fillStyle = '#64748b';
    ctx.font = `${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const instrLines = wrapCanvasText(ctx, invoice.paymentInstructions, payBoxW);
    for (const line of instrLines) {
      ctx.fillText(line, margin, payY);
      payY += 15 * scale;
    }
  }

  if (!hasInstructions) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = `italic ${12 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText('Please contact the service provider directly for payment details.', margin, payY);
    payY += 20 * scale;
  }

  curY = Math.max(sumY, payY) + 24 * scale;

  // 7. Notes & Terms Section
  if (invoice.notes) {
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(margin, curY);
    ctx.lineTo(width - margin, curY);
    ctx.stroke();
    curY += 16 * scale;

    ctx.fillStyle = '#71717a';
    ctx.font = `bold ${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText('TERMS & NOTES', margin, curY);
    curY += 16 * scale;

    ctx.fillStyle = '#475569';
    ctx.font = `${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const noteLines = wrapCanvasText(ctx, invoice.notes, contentWidth);
    for (const nLine of noteLines) {
      ctx.fillText(nLine, margin, curY);
      curY += 15 * scale;
    }
  }

  // 8. Watermark (diagonal overlay for PAID / OVERDUE / CANCELLED)
  if (statusStr === 'PAID' || statusStr === 'OVERDUE' || statusStr === 'CANCELLED') {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.textAlign = 'center';
    ctx.font = `900 ${88 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    if (statusStr === 'PAID') {
      ctx.fillStyle = 'rgba(22, 163, 74, 0.08)';
      ctx.strokeStyle = 'rgba(22, 163, 74, 0.2)';
    } else if (statusStr === 'OVERDUE') {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.08)';
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.2)';
    } else {
      ctx.fillStyle = 'rgba(100, 116, 139, 0.08)';
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
    }

    ctx.lineWidth = 2 * scale;
    ctx.strokeText(statusStr, 0, 0);
    ctx.fillText(statusStr, 0, 0);
    ctx.restore();
  }

  // 9. Footer
  const footerY = height - 28 * scale;
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(margin, footerY - 14 * scale);
  ctx.lineTo(width - margin, footerY - 14 * scale);
  ctx.stroke();

  ctx.fillStyle = '#a1a1aa';
  ctx.font = `${10 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText('Generated with FlowDesk • Verified Business Document', margin, footerY);

  ctx.textAlign = 'right';
  ctx.fillText(`Page 1 of 1 • #${invoice.invoiceNumber || 'INV-001'}`, width - margin, footerY);

  return canvas;
}

/**
 * Exports the canonical Invoice Document to a high-resolution, unclipped PNG.
 * Completely independent of html2canvas or DOM state.
 */
export async function exportInvoiceToPNG(
  elementOrId?: HTMLElement | string | null,
  invoiceNumber: string = 'Invoice',
  invoice?: Invoice,
  branding?: InvoiceBranding | UserProfile | null
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const targetInvoice = invoice || (elementOrId && typeof elementOrId === 'object' && 'invoiceNumber' in elementOrId ? (elementOrId as any) : undefined);
  if (!targetInvoice) {
    console.error('[exportInvoiceToPNG] Invoice data is required for PNG export.');
    return false;
  }

  const exportKey = `png_${targetInvoice.invoiceNumber || invoiceNumber}`;
  if (activeExports.has(exportKey)) {
    console.warn('[exportInvoiceToPNG] Export already in progress for this invoice.');
    return false;
  }
  activeExports.add(exportKey);

  try {
    const canvas = await renderInvoiceToCanvas(targetInvoice, branding);

    const blob: Blob | null = await new Promise((resolve) => {
      try {
        canvas.toBlob((b: Blob | null) => resolve(b), 'image/png');
      } catch {
        resolve(null);
      }
    });

    if (!blob) {
      // Fallback dataURL
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = sanitizeFilename(targetInvoice.invoiceNumber || invoiceNumber, 'png');
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = sanitizeFilename(targetInvoice.invoiceNumber || invoiceNumber, 'png');
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    return true;
  } catch (err) {
    console.error('[exportInvoiceToPNG] Error exporting invoice to PNG:', err);
    return false;
  } finally {
    activeExports.delete(exportKey);
  }
}

/**
 * Exports the canonical Invoice Document to a crisp JPEG image.
 * Guarantees explicit #ffffff background fill so transparent regions never become black.
 */
export async function exportInvoiceToJPG(
  elementOrId?: HTMLElement | string | null,
  invoiceNumber: string = 'Invoice',
  invoice?: Invoice,
  branding?: InvoiceBranding | UserProfile | null,
  quality: number = 0.95
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const targetInvoice = invoice || (elementOrId && typeof elementOrId === 'object' && 'invoiceNumber' in elementOrId ? (elementOrId as any) : undefined);
  if (!targetInvoice) {
    console.error('[exportInvoiceToJPG] Invoice data is required for JPEG export.');
    return false;
  }

  const exportKey = `jpg_${targetInvoice.invoiceNumber || invoiceNumber}`;
  if (activeExports.has(exportKey)) {
    console.warn('[exportInvoiceToJPG] Export already in progress for this invoice.');
    return false;
  }
  activeExports.add(exportKey);

  try {
    const canvas = await renderInvoiceToCanvas(targetInvoice, branding);

    const blob: Blob | null = await new Promise((resolve) => {
      try {
        canvas.toBlob((b: Blob | null) => resolve(b), 'image/jpeg', quality);
      } catch {
        resolve(null);
      }
    });

    if (!blob) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const link = document.createElement('a');
      link.download = sanitizeFilename(targetInvoice.invoiceNumber || invoiceNumber, 'jpg');
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = sanitizeFilename(targetInvoice.invoiceNumber || invoiceNumber, 'jpg');
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    return true;
  } catch (err) {
    console.error('[exportInvoiceToJPG] Error exporting invoice to JPEG:', err);
    return false;
  } finally {
    activeExports.delete(exportKey);
  }
}

/**
 * Exports the invoice to a high-fidelity vector PDF document.
 * Delegated to the reliable jsPDF / autotable vector engine.
 */
export async function exportInvoiceToPDF(
  invoice: Invoice,
  branding?: InvoiceBranding | UserProfile | null,
  _elementOrId?: HTMLElement | string | null
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    await vectorGeneratePDF(invoice, branding);
    return true;
  } catch (err) {
    console.error('[exportInvoiceToPDF] Vector PDF generation failed:', err);
    return false;
  }
}

/**
 * Triggers clean, high-fidelity vector print dialog for the invoice.
 */
export async function printInvoice(
  invoice: Invoice,
  branding?: InvoiceBranding | UserProfile | null,
  _elementOrId?: HTMLElement | string | null
): Promise<void> {
  if (typeof window === 'undefined') return;
  originalPrint(invoice, branding);
}

