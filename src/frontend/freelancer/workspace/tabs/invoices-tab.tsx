import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { Modal } from '@/frontend/shared/ui/modal';
import { Input } from '@/frontend/shared/ui/input';
import { InvoiceService } from '@/backend/freelancer';
import { WorkspaceSummary, Invoice } from '@/shared/types';
import { FileText, Plus, ExternalLink, Send, CheckCircle2, Eye, DollarSign } from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';

export interface InvoicesTabProps {
  summary: WorkspaceSummary;
  onRefresh: () => void;
}

export const InvoicesTab: React.FC<InvoicesTabProps> = ({ summary, onRefresh }) => {
  const { invoices, client } = summary;
  const { showToast } = useToast();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  // New Invoice Form
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('10000');
  const [dueDate, setDueDate] = useState('2026-09-15');

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount) || 5000;
    InvoiceService.createInvoice({
      clientId: client.id,
      clientName: client.company,
      clientEmail: client.email,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate,
      status: 'pending',
      currency: client.currency || 'USD',
      items: [{ description: desc || 'Professional Services', quantity: 1, rate: numericAmount, amount: numericAmount }],
      subtotal: numericAmount,
      tax: 0,
      total: numericAmount,
    }).then(() => {
      showToast('Invoice Generated', `Invoice generated for ${client.company}.`, 'success');
      setIsCreateModalOpen(false);
      setDesc('');
      onRefresh();
    });
  };

  const handleSendReminder = (inv: Invoice) => {
    InvoiceService.sendReminder(inv.id).then(() => {
      showToast('Reminder Sent', `Payment reminder sent to ${inv.clientEmail}.`, 'success');
      onRefresh();
    });
  };

  const handleMarkPaid = (inv: Invoice) => {
    InvoiceService.markAsPaid(inv.id).then(() => {
      showToast('Invoice Paid', `Invoice ${inv.invoiceNumber} marked as paid.`, 'success');
      setViewInvoice(null);
      onRefresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card variant="crystal">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{client.company} Invoices & Settlement</CardTitle>
              <CardDescription>Billing history, outstanding balances, and payment reminders</CardDescription>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Generate Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {invoices.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">No invoices issued for this client yet.</p>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 rounded-xl bg-zinc-900/50 border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{inv.invoiceNumber}</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Issued {inv.issueDate} • Due {inv.dueDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <span className="text-sm font-bold text-white font-mono">
                      ${inv.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <StatusPill status={inv.status || inv.paymentStatus || 'pending'} />

                    <Button variant="ghost" size="sm" onClick={() => setViewInvoice(inv)} leftIcon={<Eye className="w-3.5 h-3.5" />}>
                      View
                    </Button>

                    {(inv.status || inv.paymentStatus) !== 'paid' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSendReminder(inv)}
                        leftIcon={<Send className="w-3.5 h-3.5" />}
                      >
                        Send Reminder
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Invoice Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Generate Invoice for Client">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <Input
            label="Service / Deliverable Description"
            placeholder="e.g. Design System Phase 2 Handover"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount ($)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Generate & Issue Invoice
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Invoice Modal */}
      <Modal isOpen={!!viewInvoice} onClose={() => setViewInvoice(null)} title={viewInvoice?.invoiceNumber || 'Invoice Details'}>
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-zinc-950 border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h3 className="text-lg font-bold text-white">{viewInvoice?.invoiceNumber}</h3>
                <p className="text-xs text-zinc-400">Issued to {viewInvoice?.clientName}</p>
              </div>
              <StatusPill status={viewInvoice?.status || 'pending'} />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Line Items</span>
              {viewInvoice?.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs py-1 border-b border-white/5 text-zinc-300">
                  <span>{item.description} (x{item.quantity})</span>
                  <span className="font-mono text-white">${item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-between text-sm font-bold text-white font-mono">
              <span>Total Amount</span>
              <span>${viewInvoice?.total.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setViewInvoice(null)}>
              Close
            </Button>
            {(viewInvoice?.status || viewInvoice?.paymentStatus) !== 'paid' && (
              <Button
                variant="primary"
                onClick={() => viewInvoice && handleMarkPaid(viewInvoice)}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                Mark as Paid
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
