'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import { Modal } from '../../../components/ui/modal';
import { Invoice } from '../../../types';
import {
  CreditCard,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Receipt,
  Sparkles,
  Lock,
  ExternalLink,
} from 'lucide-react';

interface InvoicesPanelProps {
  invoices: Invoice[];
  onPayClick: (invoice: Invoice) => void;
  onDownloadClick: (invoice: Invoice) => void;
}

export const InvoicesPanel: React.FC<InvoicesPanelProps> = ({
  invoices,
  onPayClick,
  onDownloadClick,
}) => {
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [selectedInvoiceModal, setSelectedInvoiceModal] = useState<Invoice | null>(null);

  const filteredInvoices = invoices.filter((inv) => {
    if (filter === 'unpaid') return inv.paymentStatus !== 'paid';
    if (filter === 'paid') return inv.paymentStatus === 'paid';
    return true;
  });

  const totalOutstanding = invoices
    .filter((i) => i.paymentStatus !== 'paid')
    .reduce((sum, i) => sum + i.total, 0);

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
              ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
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
            <CreditCard className="w-10 h-10 text-zinc-600 mx-auto" />
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
                        ${inv.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-zinc-500 block uppercase">{inv.currency}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedInvoiceModal(inv)}
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                      >
                        Preview
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownloadClick(inv)}
                        leftIcon={<Download className="w-3.5 h-3.5" />}
                      >
                        PDF
                      </Button>

                      {!isPaid ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => onPayClick(inv)}
                          leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                          title="Pay Securely with Razorpay"
                        >
                          Pay Securely with Razorpay
                        </Button>
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

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={!!selectedInvoiceModal}
        onClose={() => setSelectedInvoiceModal(null)}
        title={`Statement #${selectedInvoiceModal?.invoiceNumber}`}
      >
        {selectedInvoiceModal && (
          <div className="space-y-6 font-sans">
            <div className="p-6 rounded-2xl bg-zinc-950 border border-white/10 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-white">Rivera Studio</h3>
                  <p className="text-xs text-zinc-400">Tax ID: US-948201948</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-white">{selectedInvoiceModal.invoiceNumber}</span>
                  <p className="text-[10px] text-zinc-400">Due: {selectedInvoiceModal.dueDate}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Line Items</span>
                <div className="space-y-1.5">
                  {selectedInvoiceModal.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5 text-xs">
                      <div>
                        <span className="font-semibold text-white">{item.description}</span>
                        <span className="block text-[10px] text-zinc-400 font-mono">Qty: {item.quantity} × ${item.rate}</span>
                      </div>
                      <span className="font-mono font-bold text-white">${item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="pt-3 border-t border-white/10 space-y-1 text-xs font-mono text-zinc-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${selectedInvoiceModal.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax ({selectedInvoiceModal.taxPercentage || 10}%)</span>
                  <span>${selectedInvoiceModal.tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/10">
                  <span>Total Amount</span>
                  <span>${selectedInvoiceModal.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={() => setSelectedInvoiceModal(null)}>
                Close
              </Button>
              {selectedInvoiceModal.paymentStatus !== 'paid' && (
                <Button
                  variant="primary"
                  onClick={() => {
                    const inv = selectedInvoiceModal;
                    setSelectedInvoiceModal(null);
                    onPayClick(inv);
                  }}
                  leftIcon={<CreditCard className="w-4 h-4" />}
                >
                  Pay Securely with Razorpay
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
