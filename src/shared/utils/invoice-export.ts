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
 * (e.g., clicking download directly from table rows or list views, or when responsive preview is scaled).
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

  // If no mounted element or if it's scaled down, render a clean offscreen 794px version
  if ((!targetEl || targetEl.style.transform || targetEl.closest('[style*="scale"]')) && invoice) {
    try {
      const offscreen = await renderOffscreenInvoiceDocument(invoice, branding);
      targetEl = offscreen.sheetElement;
      cleanup = offscreen.unmount;
    } catch {
      // keep targetEl
    }
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
      imageTimeout: 15000,
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

  if ((!targetEl || targetEl.style.transform || targetEl.closest('[style*="scale"]')) && invoice) {
    try {
      const offscreen = await renderOffscreenInvoiceDocument(invoice, branding);
      targetEl = offscreen.sheetElement;
      cleanup = offscreen.unmount;
    } catch {
      // keep targetEl
    }
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
      backgroundColor: '#ffffff', // Required for clean white background without transparency artifacts
      logging: false,
      windowWidth: 1200,
      imageTimeout: 15000,
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

  // If no mounted DOM element exists or scaled down, mount offscreen for 100% pixel-perfect PDF
  if (!targetEl || targetEl.style.transform || targetEl.closest('[style*="scale"]')) {
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
        imageTimeout: 15000,
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

      // Additional pages if invoice spans multiple pages
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
 * Injects host styles and uses print media rules to ensure pixel-perfect rendering.
 */
export async function printInvoice(
  invoice: Invoice,
  branding?: InvoiceBranding | UserProfile | null,
  elementOrId?: HTMLElement | string | null
): Promise<void> {
  if (typeof window === 'undefined') return;

  let targetEl = getTargetInvoiceElement(elementOrId);
  let cleanup: (() => void) | null = null;

  if (!targetEl || targetEl.style.transform || targetEl.closest('[style*="scale"]')) {
    try {
      const offscreen = await renderOffscreenInvoiceDocument(invoice, branding);
      targetEl = offscreen.sheetElement;
      cleanup = offscreen.unmount;
    } catch {
      // keep targetEl
    }
  }

  if (targetEl) {
    // Copy all style & stylesheet links from host document to iframe so Tailwind styles apply
    const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Invoice ${invoice.invoiceNumber || 'Document'}</title>
        ${styleTags}
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #09090b !important;
            width: 100% !important;
          }
          .print-wrapper {
            width: 100% !important;
            max-width: 794px !important;
            margin: 0 auto !important;
            background: #ffffff !important;
          }
          .invoice-document-sheet {
            box-shadow: none !important;
            border: none !important;
            transform: none !important;
            width: 100% !important;
            max-width: 794px !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          table, tr, .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          button, .no-print {
            display: none !important;
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
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(printHtml);
      doc.close();

      const waitIframeReady = async () => {
        if (iframe.contentWindow?.document?.fonts) {
          try {
            await iframe.contentWindow.document.fonts.ready;
          } catch {
            // ignore
          }
        }
        const images = Array.from(doc.images);
        await Promise.all(
          images.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          })
        );
        await new Promise((r) => setTimeout(r, 150));
      };

      try {
        await waitIframeReady();
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn('Iframe print failed, falling back to original print:', err);
        originalPrint(invoice, branding);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          if (cleanup) cleanup();
        }, 1500);
      }
      return;
    }
  }

  if (cleanup) cleanup();
  originalPrint(invoice, branding);
}
