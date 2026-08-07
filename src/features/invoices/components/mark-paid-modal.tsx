import React, { useState } from 'react';
import { Invoice } from '../../../types';
import { formatCurrency } from '../../../utils/currency';
import { X, CheckCircle2, ShieldCheck, CreditCard, Landmark, DollarSign } from 'lucide-react';

interface MarkPaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onConfirmPaid: (invoiceId: string, paymentMethod: string, notes?: string) => void;
}

export function MarkPaidModal({
  isOpen,
  onClose,
  invoice,
  onConfirmPaid,
}: MarkPaidModalProps) {
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');

  if (!isOpen || !invoice) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmPaid(invoice.id, paymentMethod, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Record Offline Settlement
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-1">
            <div className="flex justify-between text-zinc-500">
              <span>Invoice Number:</span>
              <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                {invoice.invoiceNumber}
              </span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Client:</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{invoice.clientName}</span>
            </div>
            <div className="flex justify-between text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
              <span>Amount Settled:</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(invoice.total, invoice.currency)}
              </span>
            </div>
          </div>

          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('bank_transfer')}
                className={`p-2.5 rounded-lg border text-left flex items-center gap-2 ${
                  paymentMethod === 'bank_transfer'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <Landmark className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Bank Wire</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('razorpay')}
                className={`p-2.5 rounded-lg border text-left flex items-center gap-2 ${
                  paymentMethod === 'razorpay'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Razorpay Direct</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-2.5 rounded-lg border text-left flex items-center gap-2 ${
                  paymentMethod === 'cash'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <DollarSign className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Cash / Check</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('other')}
                className={`p-2.5 rounded-lg border text-left flex items-center gap-2 ${
                  paymentMethod === 'other'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium'
                    : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Other Wire</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Payment Reference / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Wire reference #TXN-98402, confirmed by client finance."
              className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Settlement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
