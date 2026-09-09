'use client';

import React, { useRef, useState } from 'react';
import { Card } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { Modal } from '@/frontend/shared/ui/modal';
import { Invoice, UserProfile } from '@/shared/types';
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
} from 'lucide-react';

interface InvoicesPanelProps {
  invoices: Invoice[];
  onPayClick: (invoice: Invoice) => void;
  onDownloadClick: (invoice: Invoice) => void;
  profile?: UserProfile | null;
}

export const InvoicesPanel: React.FC<InvoicesPanelProps> = ({
  invoices,
  onPayClick,
  onDownloadClick,
  profile,
}) => {
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [selectedInvoiceModal, setSelectedInvoiceModal] = useState<Invoice | null>(null);
  const [paymentInstructionsModal, setPaymentInstructionsModal] = useState<Invoice | null>(null);
  const [exportingType, setExportingType] = useState<'pdf' | 'png' | 'jpg' | 'print' | null>(null);
  const previewDocRef = useRef<HTMLDivElement>(null);

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
      await exportInvoiceToPDF(inv, profile, previewDocRef.current);
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPNG = async (inv: Invoice) => {
    if (exportingType) return;
    setExportingType('png');
    try {
      await exportInvoiceToPNG(previewDocRef.current, inv.invoiceNumber);
    } finally {
      setExportingType(null);
    }
  };

  const handleExportJPG = async (inv: Invoice) => {
    if (exportingType) return;
    setExportingType('jpg');
    try {
      await exportInvoiceToJPG(previewDocRef.current, inv.invoiceNumber);
    } finally {
      setExportingType(null);
    }
  };

  const handlePrint = (inv: Invoice) => {
    if (exportingType) return;
    setExportingType('print');
    try {
      printInvoice(inv, profile, previewDocRef.current);
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

      {/* Upgraded Canonical Invoice Document Modal */}
      {selectedInvoiceModal && (
        <Modal
          isOpen={!!selectedInvoiceModal}
          onClose={() => setSelectedInvoiceModal(null)}
          title={`Statement #${selectedInvoiceModal.invoiceNumber}`}
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
                  Pay Securely ({formatCurrency(selectedInvoiceModal.remainingBalance ?? selectedInvoiceModal.total, selectedInvoiceModal.currency)})
                </Button>
              )}
            </div>

            {/* Document Sheet with Responsive Scaling */}
            <div className="max-h-[65vh] overflow-y-auto p-4 rounded-xl bg-zinc-950/80 border border-white/5 flex justify-center">
              <InvoiceDocument
                ref={previewDocRef}
                invoice={selectedInvoiceModal}
                branding={profile}
                responsiveScale={true}
                documentId={`client-portal-preview-${selectedInvoiceModal.id}`}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Bank Settlement Details Modal */}
      {paymentInstructionsModal && (
        <Modal
          isOpen={!!paymentInstructionsModal}
          onClose={() => setPaymentInstructionsModal(null)}
          title={`Payment Details — #${paymentInstructionsModal.invoiceNumber}`}
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex justify-between text-zinc-400">
                <span>Invoice:</span>
                <span className="font-mono text-white font-bold">{paymentInstructionsModal.invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Amount Due:</span>
                <span className="font-mono text-emerald-400 font-bold text-sm">
                  {formatCurrency(paymentInstructionsModal.remainingBalance ?? paymentInstructionsModal.total, paymentInstructionsModal.currency)}
                </span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Due Date:</span>
                <span className="font-mono text-zinc-300">{paymentInstructionsModal.dueDate}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <Landmark className="w-4 h-4" />
                <span>Bank Transfer & Settlement Instructions</span>
              </div>
              <p className="text-zinc-300 leading-relaxed">
                {paymentInstructionsModal.paymentInstructions || 'Please transfer payment to the studio bank account noted on your invoice document, quoting your invoice number as reference.'}
              </p>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setPaymentInstructionsModal(null)}>
                Close
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    const inv = paymentInstructionsModal;
                    setPaymentInstructionsModal(null);
                    onDownloadClick(inv);
                  }}
                  leftIcon={<Download className="w-4 h-4" />}
                >
                  Download PDF
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    const inv = paymentInstructionsModal;
                    setPaymentInstructionsModal(null);
                    onPayClick(inv);
                  }}
                  leftIcon={<CreditCard className="w-4 h-4" />}
                >
                  Pay with Razorpay
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
