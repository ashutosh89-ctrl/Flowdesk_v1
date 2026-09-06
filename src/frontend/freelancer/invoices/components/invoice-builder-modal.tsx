import React, { useState, useEffect } from 'react';
import { Client, Project, Invoice, InvoiceItem } from '@/shared/types';
import { FreelancerClientService, FreelancerProjectService, FreelancerInvoiceService } from '@/backend/freelancer';
import { UserSettingsService } from '@/backend/auth';
import { useAuth } from '@/frontend/auth/auth-context';
import { SUPPORTED_CURRENCIES, formatCurrency, getCurrencySymbol } from '@/shared/utils/currency';
import { X, Plus, Trash2, Copy, FileText, Check, DollarSign, AlertCircle } from 'lucide-react';
import { calculateInvoiceTotals, generateNextInvoiceNumber } from '@/shared/utils/invoice-calculations';

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
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
  const [paymentInstructions, setPaymentInstructions] = useState('Bank Transfer as outlined on this statement.');
  const [internalNotes, setInternalNotes] = useState('');

  // Line items
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 'item-1', description: 'Design Sprint & Technical Scope', quantity: 1, rate: 5000, amount: 5000 },
  ]);

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Loading state
  const [isSaving, setIsSaving] = useState(false);

  // Synchronize state when modal opens or invoiceToEdit changes
  useEffect(() => {
    if (!isOpen) return;

    FreelancerClientService.getClients().then(async (allClients) => {
      setClients(allClients);

      if (invoiceToEdit) {
        setInvoiceNumber(invoiceToEdit.invoiceNumber);
        setSelectedClientId(invoiceToEdit.clientId);
        setSelectedProjectId(invoiceToEdit.projectId || '');
        setIssueDate(invoiceToEdit.issueDate);
        setDueDate(invoiceToEdit.dueDate);
        setCurrency(invoiceToEdit.currency || 'USD');
        setTaxName(invoiceToEdit.taxName || 'GST');
        setTaxPercentage(invoiceToEdit.taxPercentage ?? 0);
        setDiscount(invoiceToEdit.discount || 0);
        setNotes(invoiceToEdit.notes || '');
        setPaymentInstructions(invoiceToEdit.paymentInstructions || '');
        setInternalNotes(invoiceToEdit.internalNotes || '');
        setItems(
          invoiceToEdit.items && invoiceToEdit.items.length > 0
            ? invoiceToEdit.items.map((it, idx) => ({ ...it, id: it.id || `item-${idx}` }))
            : [{ id: 'item-1', description: '', quantity: 1, rate: 0, amount: 0 }]
        );
        FreelancerProjectService.getProjectsByClientId(invoiceToEdit.clientId).then(setProjects);
      } else {
        const today = new Date().toISOString().split('T')[0];

        // Load user settings and existing invoices for sequential numbering
        const [settings, existingInvoices] = await Promise.all([
          user?.id ? UserSettingsService.getUserSettings(user.id) : null,
          FreelancerInvoiceService.getInvoices(),
        ]);

        const paymentTerms = settings?.default_payment_terms || 14;
        const dueDateMs = new Date(today).getTime() + paymentTerms * 86400000;
        const dueDateStr = new Date(dueDateMs).toISOString().split('T')[0];

        const nextNum = generateNextInvoiceNumber(
          settings || undefined,
          existingInvoices.map((e) => e.invoiceNumber)
        );

        setInvoiceNumber(nextNum);
        setIssueDate(today);
        setDueDate(dueDateStr);
        setTaxPercentage(settings?.default_tax_rate ?? 0);
        setTaxName(settings?.tax_name || 'Tax');

        if (allClients.length > 0) {
          const firstClient = allClients[0];
          setSelectedClientId(firstClient.id);
          setCurrency(firstClient.currency || settings?.currency || 'USD');
          FreelancerProjectService.getProjectsByClientId(firstClient.id).then(setProjects);
        } else {
          setCurrency(settings?.currency || 'USD');
          setProjects([]);
        }
        setItems([{ id: 'item-initial', description: '', quantity: 1, rate: 0, amount: 0 }]);
      }
    });
  }, [isOpen, invoiceToEdit, user?.id]);

  const handleClientSelectChange = (newClientId: string) => {
    setSelectedClientId(newClientId);
    FreelancerProjectService.getProjectsByClientId(newClientId).then(setProjects);
    setSelectedProjectId('');
    const selectedClient = clients.find((c) => c.id === newClientId);
    if (selectedClient) {
      setCurrency(selectedClient.currency || 'USD');
    }
  };

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

  // Financial calculations — using shared calculation utility
  const calc = calculateInvoiceTotals({
    items: items.map(it => ({ quantity: it.quantity, rate: it.rate })),
    taxPercentage,
    discount,
  });
  const subtotal = calc.subtotal;
  const calculatedTax = calc.taxAmount;
  const total = calc.total;

  if (!isOpen) return null;

  const handleSubmit = async (isDraft: boolean) => {
    // Validate
    const errors: string[] = [];
    if (!invoiceNumber.trim()) errors.push('Invoice number is required.');
    if (!selectedClientId) errors.push('Client is required.');
    if (!issueDate) errors.push('Issue date is required.');
    if (!dueDate) errors.push('Due date is required.');
    if (issueDate && dueDate && new Date(dueDate) < new Date(issueDate)) errors.push('Due date must not be before issue date.');
    if (items.length === 0) errors.push('At least one line item is required.');
    items.forEach((item, idx) => {
      if (!item.description.trim()) errors.push(`Line item ${idx + 1}: description is required.`);
      if (Number(item.quantity) <= 0) errors.push(`Line item ${idx + 1}: quantity must be greater than 0.`);
      if (Number(item.rate) < 0) errors.push(`Line item ${idx + 1}: rate must be 0 or greater.`);
    });
    if (taxPercentage < 0 || taxPercentage > 100) errors.push('Tax percentage must be between 0 and 100.');
    if (discount < 0) errors.push('Discount must be non-negative.');

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    const client = clients.find((c) => c.id === selectedClientId);
    const proj = projects.find((p) => p.id === selectedProjectId);

    setIsSaving(true);
    try {
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

      await onSave(payload);
      onClose();
    } catch (err) {
      setValidationErrors([err instanceof Error ? err.message : 'Failed to save invoice.']);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-zinc-950/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8 backdrop-blur-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold text-white">
              {invoiceToEdit ? `Edit Invoice (${invoiceToEdit.invoiceNumber})` : 'Create New Invoice'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                <span>Invoice Number</span>
                <span className="text-[10px] text-zinc-400 font-mono">Auto-generated</span>
              </label>
              <div className="w-full px-3 py-2 text-xs font-mono font-bold border border-white/10 rounded-xl bg-zinc-900/90 text-white flex items-center justify-between select-none shadow-inner">
                <span>{invoiceNumber || 'Generating...'}</span>
                <span className="text-[10px] text-emerald-400 font-sans font-medium px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  Locked
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1.5 leading-tight">
                Invoice numbers are generated automatically from your Invoice Settings.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Client
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => handleClientSelectChange(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-white/10 rounded-xl bg-zinc-900 text-white focus:outline-none focus:border-white/30 transition-colors shadow-inner"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                    {c.company} ({c.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Project (Optional)
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-white/10 rounded-xl bg-zinc-900 text-white focus:outline-none focus:border-white/30 transition-colors shadow-inner"
              >
                <option value="" className="bg-zinc-900 text-white">-- No Project Linked --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-white/10 rounded-xl bg-zinc-900 text-white focus:outline-none focus:border-white/30 transition-colors shadow-inner"
              >
                {SUPPORTED_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code} className="bg-zinc-900 text-white">
                    {curr.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-white/10 rounded-xl bg-zinc-900 text-white [color-scheme:dark] focus:outline-none focus:border-white/30 transition-colors shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-white/10 rounded-xl bg-zinc-900 text-white [color-scheme:dark] focus:outline-none focus:border-white/30 transition-colors shadow-inner"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Invoice Line Items
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 border border-white/10 hover:border-white/20 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" /> Add Line Item
              </button>
            </div>

            <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-950/60">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.04] border-b border-white/10 text-[11px] font-semibold text-zinc-400">
                    <th className="py-2.5 px-3 w-[45%]">Description</th>
                    <th className="py-2.5 px-3 w-[15%] text-right">Qty</th>
                    <th className="py-2.5 px-3 w-[20%] text-right">Rate ({getCurrencySymbol(currency)})</th>
                    <th className="py-2.5 px-3 w-[20%] text-right">Amount ({getCurrencySymbol(currency)})</th>
                    <th className="py-2.5 px-2 w-[8%] text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-2.5">
                        <input
                          type="text"
                          placeholder="e.g. Design Tokens Migration Sprint"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                          className="w-full px-3 py-1.5 border border-white/10 rounded-lg bg-zinc-900/80 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-colors text-xs"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-3 py-1.5 text-right border border-white/10 rounded-lg bg-zinc-900/80 text-white focus:outline-none focus:border-white/30 transition-colors text-xs"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                          className="w-full px-3 py-1.5 text-right border border-white/10 rounded-lg bg-zinc-900/80 text-white focus:outline-none focus:border-white/30 transition-colors text-xs"
                        />
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-white">
                        {formatCurrency(item.amount, currency)}
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDuplicateItem(idx)}
                            title="Duplicate row"
                            className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length === 1}
                            title="Remove row"
                            className="p-1.5 hover:bg-rose-500/20 rounded-lg text-rose-400 transition-colors disabled:opacity-30"
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

          {/* Summary Card */}
          <div className="p-5 rounded-2xl border border-white/10 bg-zinc-900/60 space-y-2.5 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold text-white">{formatCurrency(subtotal, currency)}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Tax ({taxName} {taxPercentage}%):</span>
              <span className="font-mono font-semibold text-white">{formatCurrency(calculatedTax, currency)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount:</span>
                <span className="font-mono font-semibold text-emerald-400">-{formatCurrency(discount, currency)}</span>
              </div>
            )}
            <div className="pt-2.5 border-t border-white/10 flex justify-between items-center text-sm font-bold text-white">
              <span>Total Due:</span>
              <span className="font-mono text-base font-extrabold text-amber-400">{formatCurrency(total, currency)}</span>
            </div>
          </div>

          {/* Advanced: Tax, Discount, Notes - Collapsible */}
          <div className="border border-white/10 rounded-xl overflow-hidden bg-zinc-900/40">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                Tax, Discount & Notes
              </span>
              <span className="text-[10px] font-mono text-zinc-400">{showAdvanced ? 'Collapse' : 'Expand'}</span>
            </button>
            {showAdvanced && (
              <div className="p-4 space-y-4 border-t border-white/10">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Tax Label</label>
                    <input type="text" value={taxName} onChange={(e) => setTaxName(e.target.value)} placeholder="e.g. GST, VAT" className="w-full px-3 py-2 text-xs border border-white/10 rounded-xl bg-zinc-900/80 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Tax Rate (%)</label>
                    <input type="number" min="0" max="100" value={taxPercentage} onChange={(e) => setTaxPercentage(Number(e.target.value))} className="w-full px-3 py-2 text-xs border border-white/10 rounded-xl bg-zinc-900/80 text-white focus:outline-none focus:border-white/30 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Discount Amount ({getCurrencySymbol(currency)})</label>
                  <input type="number" min="0" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-full px-3 py-2 text-xs border border-white/10 rounded-xl bg-zinc-900/80 text-white focus:outline-none focus:border-white/30 transition-colors" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Client Notes</label>
                    <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 text-xs border border-white/10 rounded-xl bg-zinc-900/80 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Payment Instructions</label>
                    <textarea rows={2} value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} className="w-full px-3 py-2 text-xs border border-white/10 rounded-xl bg-zinc-900/80 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-colors" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mx-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-semibold text-rose-300">Please fix the following:</span>
            </div>
            <ul className="text-xs text-rose-400 space-y-0.5">
              {validationErrors.map((err, idx) => (
                <li key={idx}>• {err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-zinc-950/80">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold border border-white/10 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white transition-all shadow-sm disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-white hover:bg-amber-400 text-zinc-950 transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : <><Check className="w-4 h-4" /> Save & Issue Invoice</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
