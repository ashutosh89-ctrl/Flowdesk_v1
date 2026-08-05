import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { StatusPill } from '../../components/ui/status-pill';
import { Modal } from '../../components/ui/modal';
import { Drawer } from '../../components/ui/drawer';
import { InvoiceService, ClientService } from '../../services';
import { Invoice, Client, InvoiceItem } from '../../types';
import { Plus, Search, FileText, CheckCircle2, DollarSign, ExternalLink, Printer } from 'lucide-react';
import { useToast } from '../../components/ui/toast';

export const InvoicesListView: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { showToast } = useToast();

  // Create Invoice State
  const [clientId, setClientId] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: 'Design System Architecture Phase 1', quantity: 1, rate: 12000, amount: 12000 },
  ]);

  const loadData = () => {
    InvoiceService.getInvoices().then(setInvoices);
    ClientService.getClients().then((cls) => {
      setClients(cls);
      if (cls.length > 0) setClientId(cls[0].id);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkPaid = (id: string) => {
    InvoiceService.markAsPaid(id).then(() => {
      showToast('Payment Recorded', 'Invoice marked as paid.', 'success');
      loadData();
      if (selectedInvoice && selectedInvoice.id === id) {
        setSelectedInvoice({ ...selectedInvoice, status: 'paid' });
      }
    });
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const targetClient = clients.find((c) => c.id === clientId);
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

    InvoiceService.createInvoice({
      clientId,
      clientName: targetClient ? targetClient.company : 'Client',
      clientEmail: targetClient ? targetClient.email : 'client@company.com',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: '2026-08-28',
      status: 'pending',
      items,
      subtotal,
      tax: 0,
      total: subtotal,
      currency: 'USD',
    }).then(() => {
      showToast('Invoice Created', 'New invoice added to ledger.', 'success');
      setIsCreateModalOpen(false);
      loadData();
    });
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingTotal = invoices
    .filter((i) => i.status === 'pending' || i.status === 'overdue')
    .reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Invoice Ledger</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Generate, send, and track client settlements.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
          Generate Invoice
        </Button>
      </div>

      {/* Outstanding Stats Banner */}
      <Card variant="crystal" className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase text-zinc-400">Outstanding Balance</span>
            <p className="text-3xl font-bold text-white mt-1">
              ${pendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-zinc-400 mt-1">Across pending and overdue client accounts</p>
          </div>
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900 border border-white/10 rounded-xl">
            {['all', 'paid', 'pending', 'draft'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                  statusFilter === st ? 'bg-white text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Search Input */}
      <div className="w-full sm:w-80">
        <Input
          type="search"
          placeholder="Search by invoice # or client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {/* Invoices Table */}
      <div className="space-y-3">
        {filteredInvoices.map((inv) => (
          <div
            key={inv.id}
            onClick={() => setSelectedInvoice(inv)}
            className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 hover:border-white/20 hover:bg-zinc-900/80 transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-white shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">{inv.invoiceNumber}</h4>
                  <span className="text-xs text-zinc-400">• {inv.clientName}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Issued {inv.issueDate} • Due {inv.dueDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 self-end sm:self-auto">
              <span className="text-base font-bold text-white">
                ${inv.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <StatusPill status={inv.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Invoice Detail Drawer */}
      {selectedInvoice && (
        <Drawer
          isOpen={!!selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          title={`Invoice ${selectedInvoice.invoiceNumber}`}
          size="md"
        >
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>Client: <strong className="text-white">{selectedInvoice.clientName}</strong></span>
                <StatusPill status={selectedInvoice.status} />
              </div>
              <p className="text-xs text-zinc-400">Recipient: {selectedInvoice.clientEmail}</p>
            </div>

            {/* Line Items */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Line Items</h4>
              <div className="space-y-2">
                {selectedInvoice.items.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-zinc-900 border border-white/5 flex justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white">{item.description}</p>
                      <span className="text-zinc-500">{item.quantity} x ${item.rate.toLocaleString()}</span>
                    </div>
                    <span className="font-bold text-white">${item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="pt-4 border-t border-white/10 space-y-2 text-xs text-zinc-300">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${selectedInvoice.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-white pt-2 border-t border-white/5">
                <span>Total Amount</span>
                <span>${selectedInvoice.total.toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              {selectedInvoice.status !== 'paid' && (
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => handleMarkPaid(selectedInvoice.id)}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Mark as Paid
                </Button>
              )}
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => showToast('Print', 'Preparing invoice PDF print view...', 'info')}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                Print / Export PDF
              </Button>
            </div>
          </div>
        </Drawer>
      )}

      {/* Create Invoice Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Generate New Invoice">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">Client Workspace</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-white/30"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company} ({c.name})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300">Line Item Description</label>
            <Input
              value={items[0].description}
              onChange={(e) =>
                setItems([{ ...items[0], description: e.target.value }])
              }
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Quantity / Hours"
                type="number"
                value={items[0].quantity}
                onChange={(e) => {
                  const q = parseFloat(e.target.value) || 1;
                  setItems([{ ...items[0], quantity: q, amount: q * items[0].rate }]);
                }}
                required
              />
              <Input
                label="Rate ($)"
                type="number"
                value={items[0].rate}
                onChange={(e) => {
                  const r = parseFloat(e.target.value) || 0;
                  setItems([{ ...items[0], rate: r, amount: items[0].quantity * r }]);
                }}
                required
              />
            </div>
          </div>

          <div className="pt-2 text-right text-sm font-bold text-white">
            Total: ${(items[0].quantity * items[0].rate).toLocaleString()}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Issue Invoice
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
