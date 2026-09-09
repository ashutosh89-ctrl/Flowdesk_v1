import React, { useRef, useState } from 'react';
import { Invoice, UserProfile } from '@/shared/types';
import {
  exportInvoiceToPDF,
  exportInvoiceToPNG,
  exportInvoiceToJPG,
  printInvoice,
} from '@/shared/utils/invoice-export';
import { InvoiceDocument } from '@/frontend/shared/invoice/invoice-document';
import {
  X,
  Printer,
  Download,
  Shield,
  Image as ImageIcon,
  Loader2,
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
  const [exportingType, setExportingType] = useState<'pdf' | 'png' | 'jpg' | 'print' | null>(null);
  const documentRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !invoice) return null;

  const handleExportPDF = async () => {
    if (exportingType) return;
    setExportingType('pdf');
    try {
      await exportInvoiceToPDF(invoice, profile, documentRef.current);
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPNG = async () => {
    if (exportingType) return;
    setExportingType('png');
    try {
      await exportInvoiceToPNG(documentRef.current, invoice.invoiceNumber);
    } finally {
      setExportingType(null);
    }
  };

  const handleExportJPG = async () => {
    if (exportingType) return;
    setExportingType('jpg');
    try {
      await exportInvoiceToJPG(documentRef.current, invoice.invoiceNumber);
    } finally {
      setExportingType(null);
    }
  };

  const handlePrint = () => {
    if (exportingType) return;
    setExportingType('print');
    try {
      printInvoice(invoice, profile, documentRef.current);
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-6 backdrop-blur-2xl text-white">
        {/* Top Portal Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5 bg-white/[0.03] border-b border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold tracking-wide uppercase text-[11px] text-zinc-300">
              FlowDesk Client Portal — Verified Invoice Document
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportPDF}
              disabled={!!exportingType}
              aria-label="Download Invoice PDF"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {exportingType === 'pdf' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{exportingType === 'pdf' ? 'Preparing...' : 'PDF'}</span>
            </button>

            <button
              onClick={handleExportPNG}
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
              onClick={handleExportJPG}
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
              onClick={handlePrint}
              disabled={!!exportingType}
              aria-label="Print Invoice Document"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-300" />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              aria-label="Close invoice preview"
              className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice Document Canvas */}
        <div className="p-6 max-h-[80vh] overflow-y-auto bg-zinc-950/90 flex justify-center">
          <InvoiceDocument
            ref={documentRef}
            invoice={invoice}
            branding={profile}
            responsiveScale={true}
            documentId={`portal-modal-invoice-${invoice.id}`}
          />
        </div>
      </div>
    </div>
  );
}
