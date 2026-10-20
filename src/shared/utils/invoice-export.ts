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
 * Converts a remote HTTP image URL to a local Base64 Data URL to guarantee zero canvas tainting.
 */
async function toSafeDataUrl(url?: string): Promise<string | undefined> {
  if (!url || typeof window === 'undefined') return url;
  if (url.startsWith('data:')) return url;

  const convertBlobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          resolve(url);
        }
      };
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });

  // Attempt 1: direct CORS fetch
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      return await convertBlobToDataUrl(blob);
    }
  } catch {
    // direct fetch failed (e.g. CORS preflight blocked)
  }

  // Attempt 2: server-side image proxy fallback to guarantee 100% untainted canvas
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const proxyRes = await fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);
      if (proxyRes.ok) {
        const blob = await proxyRes.blob();
        return await convertBlobToDataUrl(blob);
      }
    } catch {
      // proxy fallback failed
    }
  }

  return url;
}

/**
 * Renders an offscreen InvoiceDocument for cases when no modal preview is mounted in the DOM.
 */
async function renderOffscreenInvoiceDocument(
  invoice: Invoice,
  branding?: InvoiceBranding | UserProfile | null
): Promise<{ container: HTMLElement; unmount: () => void; sheetElement: HTMLElement }> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.minHeight = '1123px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-99999';
  container.style.opacity = '1';
  container.style.visibility = 'visible';
  container.style.pointerEvents = 'none';
  container.style.overflow = 'visible';
  document.body.appendChild(container);

  // Pre-convert remote branding assets to local Data URIs to eliminate cross-origin taint
  let safeBranding: any = branding ? { ...branding } : {};
  if (safeBranding.logoUrl) {
    safeBranding.logoUrl = await toSafeDataUrl(safeBranding.logoUrl);
  }
  if (safeBranding.signatureUrl) {
    safeBranding.signatureUrl = await toSafeDataUrl(safeBranding.signatureUrl);
  }

  const { createRoot } = await import('react-dom/client');
  const { InvoiceDocument } = await import('@/frontend/shared/invoice/invoice-document');
  const root = createRoot(container);

  root.render(
    React.createElement(InvoiceDocument, {
      invoice,
      branding: safeBranding,
      responsiveScale: false,
    })
  );

  // Allow DOM mounting, React rendering, and fonts to paint
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font error
    }
  }

  // Ensure all images are fully loaded before capturing
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    })
  );

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
 * Captures an invoice document (from an active DOM node or freshly rendered offscreen)
 * into a high-resolution, unclipped, untainted HTMLCanvasElement.
 */
async function captureInvoiceCanvas(
  elementOrId?: HTMLElement | string | null,
  invoice?: Invoice,
  branding?: InvoiceBranding | UserProfile | null
): Promise<HTMLCanvasElement> {
  const targetEl = getTargetInvoiceElement(elementOrId);

  // Mode 1: Element is already mounted in DOM (e.g. preview modal)
  if (targetEl && document.body.contains(targetEl)) {
    const sandbox = document.createElement('div');
    sandbox.style.position = 'fixed';
    sandbox.style.left = '0';
    sandbox.style.top = '0';
    sandbox.style.width = '794px';
    sandbox.style.minHeight = '1123px';
    sandbox.style.background = '#ffffff';
    sandbox.style.zIndex = '-99999';
    sandbox.style.pointerEvents = 'none';
    sandbox.style.overflow = 'visible';

    const clone = targetEl.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';
    clone.style.transformOrigin = 'top left';
    clone.style.margin = '0';
    clone.style.boxShadow = 'none';
    clone.style.border = 'none';
    clone.style.width = '794px';
    clone.style.minHeight = '1123px';
    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);

    try {
      // Convert all images in clone to local data URLs to guarantee 100% untainted canvas
      const imgs = Array.from(sandbox.querySelectorAll('img'));
      await Promise.all(
        imgs.map(async (img) => {
          const src = img.getAttribute('src') || img.src;
          if (src && !src.startsWith('data:')) {
            const dataUrl = await toSafeDataUrl(src);
            if (dataUrl) img.src = dataUrl;
          }
          if (img.complete) return Promise.resolve();
          return new Promise((r) => {
            img.onload = r;
            img.onerror = r;
          });
        })
      );

      if (document.fonts) {
        try {
          await document.fonts.ready;
        } catch {
          // ignore font readiness
        }
      }

      const canvas = await (html2canvas as any)(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
      });

      return canvas;
    } finally {
      if (document.body.contains(sandbox)) {
        document.body.removeChild(sandbox);
      }
    }
  }

  // Mode 2: No DOM element mounted (e.g. table download click) -> render offscreen
  if (invoice) {
    const offscreen = await renderOffscreenInvoiceDocument(invoice, branding);
    try {
      const canvas = await (html2canvas as any)(offscreen.sheetElement, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
      });
      return canvas;
    } finally {
      offscreen.unmount();
    }
  }

  throw new Error('Target invoice element or invoice data not available for capture.');
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

  try {
    const canvas = await captureInvoiceCanvas(elementOrId, invoice, branding);

    const blob: Blob | null = await new Promise((resolve) => {
      try {
        canvas.toBlob((b: Blob | null) => resolve(b), 'image/png');
      } catch {
        resolve(null);
      }
    });

    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = sanitizeFilename(invoiceNumber, 'png');
      link.href = blobUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      return true;
    }

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

  try {
    const canvas = await captureInvoiceCanvas(elementOrId, invoice, branding);

    const blob: Blob | null = await new Promise((resolve) => {
      try {
        canvas.toBlob((b: Blob | null) => resolve(b), 'image/jpeg', 0.95);
      } catch {
        resolve(null);
      }
    });

    if (blob) {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = sanitizeFilename(invoiceNumber, 'jpg');
      link.href = blobUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      return true;
    }

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
  }
}

/**
 * Exports the rendered Invoice Document to a multi-page PDF using high-resolution Canvas.
 * Falls back to jsPDF vector layout if canvas generation encounters errors.
 */
export async function exportInvoiceToPDF(
  invoice: Invoice,
  branding?: InvoiceBranding | UserProfile | null,
  elementOrId?: HTMLElement | string | null
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const canvas = await captureInvoiceCanvas(elementOrId, invoice, branding);
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
    try {
      await vectorGeneratePDF(invoice, branding);
      return true;
    } catch (vErr) {
      console.error('Vector PDF export failed as well:', vErr);
      return false;
    }
  }
}

/**
 * Triggers clean, high-fidelity vector print dialog for the invoice.
 * Uses dedicated print window / clean print styling so print is never blank.
 */
export async function printInvoice(
  invoice: Invoice,
  branding?: InvoiceBranding | UserProfile | null,
  elementOrId?: HTMLElement | string | null
): Promise<void> {
  if (typeof window === 'undefined') return;

  // Delegate directly to the vector print engine in invoice-pdf.ts
  originalPrint(invoice, branding);
}
