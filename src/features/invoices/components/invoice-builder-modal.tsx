import React, { useState, useEffect } from 'react';
import { Client, Project, Invoice, InvoiceItem } from '../../../types';
import { FlowDeskStore } from '../../../services/storage-store';
import { SUPPORTED_CURRENCIES, formatCurrency, getCurrencySymbol } from '../../../utils/currency';
import { X, Plus, Trash2, Copy, FileText, Check, DollarSign } from 'lucide-react';

interface InvoiceBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceToEdit?: Invoice | null;
  onSave: (invoiceData: any) => void;
}

export function InvoiceBuilderModal({
  isOpen,
  onClose,
  invoiceToEdit,
  onSave,
}: InvoiceBuilderModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Form states
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [taxName, setTaxName] = useState('GST');
  const [taxPercentage, setTaxPercentage] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [notes, setNotes] = useState('Thank you for your business. Payment due as outlined.');
  const [paymentInstructions, setPaymentInstructions] = useState('Bank Transfer or Secure Razorpay Link.');
  const [internalNotes, setInternalNotes] = useState('');

  // Line items
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 'item-1', description: 'Design Sprint & Technical Scope', quantity: 1, rate: 5000, amount: 5000 },
  ]);

  // Track prev props to handle state sync without triggering setState in useEffect
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  const [prevInvoiceToEdit, setPrevInvoiceToEdit] = useState<Invoice | null | undefined>(undefined);

  if (isOpen !== prevIsOpen || invoiceToEdit !== prevInvoiceToEdit) {
    setPrevIsOpen(isOpen);
    setPrevInvoiceToEdit(invoiceToEdit);

    if (isOpen) {
      const allClients = FlowDeskStore.getClients();
      setClients(allClients);

      if (invoiceToEdit) {
        setInvoiceNumber(invoiceToEdit.invoiceNumber);
        setSelectedClientId(invoiceToEdit.clientId);
        setSelectedProjectId(invoiceToEdit.projectId || '');
        setIssueDate(invoiceToEdit.issueDate);
        setDueDate(invoiceToEdit.dueDate);
        setCurrency(invoiceToEdit.currency || 'USD');
        setTaxName(invoiceToEdit.taxName || 'GST');
        setTaxPercentage(invoiceToEdit.taxPercentage || 0);
        setDiscount(invoiceToEdit.discount || 0);
        setNotes(invoiceToEdit.notes || '');
        setPaymentInstructions(invoiceToEdit.paymentInstructions || '');
        setInternalNotes(invoiceToEdit.internalNotes || '');
        setItems(
          invoiceToEdit.items && invoiceToEdit.items.length > 0
            ? invoiceToEdit.items.map((it, idx) => ({ ...it, id: it.id || `item-${idx}` }))
            : [{ id: 'item-1', description: '', quantity: 1, rate: 0, amount: 0 }]
        );
        setProjects(FlowDeskStore.getProjectsByClientId(invoiceToEdit.clientId));
      } else {
        const invCount = FlowDeskStore.getInvoices().length + 1;
        setInvoiceNumber(`FD-2026-${invCount.toString().padStart(4, '0')}`);
        const today = new Date().toISOString().split('T')[0];
        const nextTwoWeeks = new Date(Date.parse(today) + 14 * 86400000).toISOString().split('T')[0];
        setIssueDate(today);
        setDueDate(nextTwoWeeks);

        if (allClients.length > 0) {
          const firstClient = allClients[0];
          setSelectedClientId(firstClient.id);
          setCurrency(firstClient.currency || 'USD');
          setProjects(FlowDeskStore.getProjectsByClientId(firstClient.id));
        } else {
          setProjects([]);
        }
        setItems([{ id: 'item-initial', description: '', quantity: 1, rate: 0, amount: 0 }]);
      }
    }
  }

  const handleClientSelectChange = (newClientId: string) => {
    setSelectedClientId(newClientId);
    const clientProjs = FlowDeskStore.getProjectsByClientId(newClientId);
    setProjects(clientProjs);
    setSelectedProjectId('');
    const selectedClient = clients.find((c) => c.id === newClientId);
    if (selectedClient) {
      setCurrency(selectedClient.currency || 'USD');
    }
  };

  if (!isOpen) return null;

  // Item handlers
  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'rate') {
      const qty = field === 'quantity' ? Number(value) : item.quantity;
      const rate = field === 'rate' ? Number(value) : item.rate;
      item.amount = Math.max(0, qty * rate);
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: `item-${Date.now()}`, description: '', quantity: 1, rate: 0, amount: 0 },
    ]);
  };

  const handleDuplicateItem = (index: number) => {
    const itemToDup = items[index];
    const duped = { ...itemToDup, id: `item-${Date.now()}` };
    const newItems = [...items];
    newItems.splice(index + 1, 0, duped);
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Financial calculations
  const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const calculatedTax = (subtotal * taxPercentage) / 100;
  const total = Math.max(0, subtotal + calculatedTax - discount);

  const handleSubmit = (isDraft: boolean) => {
    const client = clients.find((c) => c.id === selectedClientId);
    const proj = projects.find((p) => p.id === selectedProjectId);

    const payload = {
      invoiceNumber,
      clientId: selectedClientId,
      clientName: client ? client.company : 'Client Workspace',
      clientEmail: client ? client.email : '',
      projectId: selectedProjectId || undefined,
      projectName: proj ? proj.title : undefined,
      issueDate,
      dueDate,
      workflowStatus: isDraft ? ('draft' as const) : ('sent' as const),
      paymentStatus: 'pending' as const,
      currency,
      items,
      subtotal,
      taxName,
      taxPercentage,
      tax: calculatedTax,
      discount,
      total,
      notes,
      paymentInstructions,
      internalNotes,
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {invoiceToEdit ? `Edit Invoice (${invoiceToEdit.invoiceNumber})` : 'Create New Invoice'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Invoice Number
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Client
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientSelectChange(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} ({c.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Project (Optional)
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                <option value="">-- No Project Linked --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                {SUPPORTED_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Invoice Line Items
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800"
              >
                <Plus className="w-3.5 h-3.5" /> Add Line Item
              </button>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    <th className="py-2 px-3 w-[45%]">Description</th>
                    <th className="py-2 px-3 w-[15%] text-right">Qty</th>
                    <th className="py-2 px-3 w-[20%] text-right">Rate ({getCurrencySymbol(currency)})</th>
                    <th className="py-2 px-3 w-[20%] text-right">Amount ({getCurrencySymbol(currency)})</th>
                    <th className="py-2 px-2 w-[8%] text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="e.g. Design Tokens Migration Sprint"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-2 py-1 text-right border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                          className="w-full px-2 py-1 text-right border border-zinc-200 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(item.amount, currency)}
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDuplicateItem(idx)}
                            title="Duplicate row"
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-500"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length === 1}
                            title="Remove row"
                            className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950 rounded text-rose-500 disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tax, Discount & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Tax Label
                  </label>
                  <input
                    type="text"
                    value={taxName}
                    onChange={(e) => setTaxName(e.target.value)}
                    placeholder="e.g. GST, VAT"
                    className="w-full px-2.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={taxPercentage}
                    onChange={(e) => setTaxPercentage(Number(e.target.value))}
                    className="w-full px-2.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Discount Amount ({getCurrencySymbol(currency)})
                </label>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full px-2.5 py-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Calculations Card */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Subtotal:</span>
                <span className="font-mono font-medium">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Tax ({taxName} {taxPercentage}%):</span>
                <span className="font-mono font-medium">{formatCurrency(calculatedTax, currency)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount:</span>
                  <span className="font-mono font-medium">-{formatCurrency(discount, currency)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-between text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <span>Total Due:</span>
                <span className="font-mono">{formatCurrency(total, currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Client Notes (Visible on Invoice)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Payment Instructions
              </label>
              <textarea
                rows={2}
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              className="px-4 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Save & Issue Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
