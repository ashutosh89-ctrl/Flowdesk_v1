import React, { useState, useEffect } from 'react';
import { Invoice } from '@/shared/types';
import { formatCurrency, getCurrencySymbol } from '@/shared/utils/currency';
import { X, CheckCircle2, ShieldCheck, Landmark, DollarSign, ArrowRightLeft } from 'lucide-react';

interface MarkPaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onConfirmPaid: (invoiceId: string, paymentMethod: string, notes?: string, amount?: number) => void;
}

export function MarkPaidModal({
  isOpen,
  onClose,
  invoice,
  onConfirmPaid,
}: MarkPaidModalProps) {
  // The parent remounts this modal (key={invoice.id}) so state initializes per
  // invoice — no reset effect required.
  const remainingBalance = invoice
    ? (invoice.remainingBalance ?? Math.max(0, invoice.total - (invoice.paidAmount || 0)))
    : 0;
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState<number>(() => remainingBalance);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !invoice) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('Settlement amount must be greater than 0.');
      return;
    }
    if (amount > remainingBalance + 0.01) {
      setError(`Settlement amount cannot exceed remaining balance of ${formatCurrency(remainingBalance, invoice.currency)}.`);
      return;
    }

    onConfirmPaid(invoice.id, paymentMethod, notes, amount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-zinc-950/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-emerald-500/10">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">
              Record Offline Settlement
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/80 space-y-2">
            <div className="flex justify-between text-zinc-400">
              <span>Invoice Number:</span>
              <span className="font-mono font-bold text-white">
                {invoice.invoiceNumber}
              </span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Client:</span>
              <span className="font-semibold text-white">{invoice.clientName}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Total Statement:</span>
              <span className="font-mono font-bold text-white">
                {formatCurrency(invoice.total, invoice.currency)}
              </span>
            </div>
            {(invoice.paidAmount || 0) > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>Already Settled:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  {formatCurrency(invoice.paidAmount || 0, invoice.currency)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-zinc-400 pt-2 border-t border-white/10">
              <span className="font-semibold text-zinc-200">Remaining Balance:</span>
              <span className="font-mono font-bold text-amber-400">
                {formatCurrency(remainingBalance, invoice.currency)}
              </span>
            </div>
          </div>

          {/* Settle Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-medium text-zinc-300">
                Amount to Record ({getCurrencySymbol(invoice.currency)})
              </label>
              <button
                type="button"
                onClick={() => setAmount(remainingBalance)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold transition-colors cursor-pointer"
              >
                Pay Full Balance
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={remainingBalance}
              value={amount}
              onChange={(e) => {
                setAmount(parseFloat(e.target.value) || 0);
                setError(null);
              }}
              className="w-full px-3 py-2 border border-white/10 rounded-xl bg-zinc-900 text-white font-mono text-sm focus:outline-none focus:border-white/30 transition-colors shadow-inner"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-zinc-300 mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('bank_transfer')}
                className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-colors cursor-pointer ${
                  paymentMethod === 'bank_transfer'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-semibold'
                    : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Landmark className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Bank Wire</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('online')}
                className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-colors cursor-pointer ${
                  paymentMethod === 'online'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-semibold'
                    : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <ArrowRightLeft className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Online Transfer</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-colors cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-semibold'
                    : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Cash / Cheque</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('other')}
                className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-colors cursor-pointer ${
                  paymentMethod === 'other'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 font-semibold'
                    : 'border-white/10 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Other Settlement</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block font-medium text-zinc-300 mb-1.5">
              Payment Reference / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Wire reference #TXN-98402, confirmed by client finance."
              className="w-full px-3 py-2 border border-white/10 rounded-xl bg-zinc-900 text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 transition-colors shadow-inner"
            />
          </div>

          {error && (
            <p className="text-rose-400 text-[11px] font-medium">{error}</p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" /> Confirm Settlement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

