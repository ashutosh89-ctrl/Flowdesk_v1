import React from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Invoice, UserProfile, InvoiceBranding } from '@/shared/types';
import { printInvoiceDocument as originalPrint, generateInvoicePDF as vectorGeneratePDF } from './invoice-pdf';

/**
 * Sanitizes an invoice number for safe cross-platform file naming.
 * Example: 'INV/2026/001' -> 'INV_2026_001'
 */
export function sanitizeFilename(invoiceNumber: string, ext: string = 'pdf'): string {
  const clean = (invoiceNumber || 'Invoice').replace(/[/\\?%*:|"<>]/g, '_').trim();
  return `FlowDesk-Invoice-${clean}.${ext}`;
}

/**
 * Finds or clones the invoice document DOM element for export.
 */
function getTargetInvoiceElement(elementOrId?: HTMLElement | string | null): HTMLElement | null {
  if (!elementOrId) {
    // Try to find the default invoice document sheet in DOM
    const el = document.querySelector('.invoice-document-sheet');
    return el as HTMLElement | null;
  }

  if (typeof elementOrId === 'string') {
    const el = document.getElementById(elementOrId) || document.querySelector(elementOrId);
    return el as HTMLElement | null;
  }

  return elementOrId;
}

/**
 * Renders an offscreen InvoiceDocument for cases when no modal preview is mounted in the DOM
 * (e.g., clicking download directly from table rows or list views).
 */
async function renderOffscreenInvoiceDocument(
  invoice: Invoice,
  branding?: InvoiceBranding | UserProfile | null
): Promise<{ container: HTMLElement; unmount: () => void; sheetElement: HTMLElement }> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-9999';
  container.style.opacity = '1';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  const { createRoot } = await import('react-dom/client');
  const { InvoiceDocument } = await import('@/frontend/shared/invoice/invoice-document');
  const root = createRoot(container);

  root.render(
    React.createElement(InvoiceDocument, {
      invoice,
      branding,
      responsiveScale: false,
    })
  );

  // Allow DOM mounting, React rendering, and fonts to paint
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font error
    }
  }

  const sheetElement = (container.querySelector('.invoice-document-sheet') as HTMLElement) || container;

  return {
    container,
    sheetElement,
    unmount: () => {
      try {
        root.unmount();
      } catch {
        // ignore
      }
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    },
  };
}

/**
 * Exports the rendered Invoice Document to a high-resolution crisp PNG (2x scale).
 */
export async function exportInvoiceToPNG(
  elementOrId?: HTMLElement | string | null,
  invoiceNumber: string = 'Invoice',
  invoice?: Invoice,
  branding?: InvoiceBranding | UserProfile | null
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  let targetEl = getTargetInvoiceElement(elementOrId);
  let cleanup: (() => void) | null = null;

  if (!targetEl && invoice) {
    const offscreen = await renderOffscreenInvoiceDocument(invoice, branding);
    targetEl = offscreen.sheetElement;
    cleanup = offscreen.unmount;
  }

  if (!targetEl) {
    console.error('Invoice export failed: Target document element not found.');
    return false;
  }

  try {
    const canvas = await (html2canvas as any)(targetEl, {
      scale: 2, // 2x high resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1200,
    });

    const dataUrl = canvas.toDataURL('image/png', 1.0);
    const link = document.createElement('a');
    link.download = sanitizeFilename(invoiceNumber, 'png');
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Failed to export invoice to PNG:', err);
    return false;
  } finally {
    if (cleanup) cleanup();
  }
}

/**
 * Exports the rendered Invoice Document to a lightweight, high-quality JPG image.
 */
export async function exportInvoiceToJPG(
  elementOrId?: HTMLElement | string | null,
  invoiceNumber: string = 'Invoice',
  invoice?: Invoice,
  branding?: InvoiceBranding | UserProfile | null
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  let targetEl = getTargetInvoiceElement(elementOrId);
  let cleanup: (() => void) | null = null;

  if (!targetEl && invoice) {
    const offscreen = await renderOffscreenInvoiceDocument(invoice, branding);
    targetEl = offscreen.sheetElement;
    cleanup = offscreen.unmount;
  }

  if (!targetEl) {
    console.error('Invoice export failed: Target document element not found.');
    return false;
  }

  try {
    const canvas = await (html2canvas as any)(targetEl, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1200,
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const link = document.createElement('a');
    link.download = sanitizeFilename(invoiceNumber, 'jpg');
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Failed to export invoice to JPG:', err);
    return false;
  } finally {
    if (cleanup) cleanup();
  }
}

/**
 * Exports the rendered Invoice Document to a pristine, publication-grade A4 PDF.
 * Preserves the exact font rendering, ₹ Indian Rupee symbols, and page proportions.
 */
export async function exportInvoiceToPDF(
  invoice: Invoice,
  branding?: InvoiceBranding | UserProfile | null,
  elementOrId?: HTMLElement | string | null
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  let targetEl = getTargetInvoiceElement(elementOrId);
  let cleanup: (() => void) | null = null;

  // If no mounted DOM element exists, mount offscreen so we generate 100% pixel-perfect PDF
  if (!targetEl) {
    try {
      const offscreen = await renderOffscreenInvoiceDocument(invoice, branding);
      targetEl = offscreen.sheetElement;
      cleanup = offscreen.unmount;
    } catch (offscreenErr) {
      console.warn('Offscreen invoice render notice:', offscreenErr);
    }
  }

  // Render high-res PDF via canvas for 100% fidelity to preview
  if (targetEl) {
    try {
      const canvas = await (html2canvas as any)(targetEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1200,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // First Page
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      // Additional pages if invoice is long
      while (heightLeft > 5) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      const filename = sanitizeFilename(invoice.invoiceNumber, 'pdf');
      pdf.save(filename);
      return true;
    } catch (err) {
      console.warn('Canvas PDF export encountered an error, falling back to vector generator:', err);
    } finally {
      if (cleanup) cleanup();
    }
  }

  // Fallback to vector PDF generator
  try {
    await vectorGeneratePDF(invoice, branding);
    return true;
  } catch (err) {
    console.error('PDF export failed:', err);
    return false;
  }
}

/**
 * Triggers clean print dialog with only the invoice document visible.
 */
export async function printInvoice(
  invoice: Invoice,
  branding?: InvoiceBranding | UserProfile | null,
  elementOrId?: HTMLElement | string | null
): Promise<void> {
  if (typeof window === 'undefined') return;

  let targetEl = getTargetInvoiceElement(elementOrId);
  let cleanup: (() => void) | null = null;

  if (!targetEl) {
    try {
      const offscreen = await renderOffscreenInvoiceDocument(invoice, branding);
      targetEl = offscreen.sheetElement;
      cleanup = offscreen.unmount;
    } catch {
      // ignore
    }
  }

  if (targetEl) {
    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 15mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #ffffff;
            color: #09090b;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-wrapper {
            width: 100%;
            max-width: 794px;
            margin: 0 auto;
          }
        </style>
      </head>
      <body>
        <div class="print-wrapper">
          ${targetEl.outerHTML}
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
    if (doc) {
      doc.open();
      doc.write(printHtml);
      doc.close();

      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          if (cleanup) cleanup();
        }, 1000);
      }, 350);
      return;
    }
  }

  if (cleanup) cleanup();
  // Fallback print
  originalPrint(invoice, branding);
}
