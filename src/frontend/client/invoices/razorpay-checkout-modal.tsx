'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { Button } from '@/frontend/shared/ui/button';
import { Card } from '@/frontend/shared/ui/card';
import { Invoice, InvoiceReceipt } from '@/shared/types';
import { formatCurrency } from '@/shared/utils/currency';
import {
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ArrowRight,
  Loader2,
  Lock,
} from 'lucide-react';

interface RazorpayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  clientId?: string;
  onPaymentSuccess?: (receipt?: InvoiceReceipt) => void;
}

type CheckoutStep = 'configure' | 'loading_order' | 'processing' | 'verifying' | 'success' | 'failed';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  isOpen,
  onClose,
  invoice,
  clientId,
  onPaymentSuccess,
}) => {
  // Remaining balance calculation (also used for the lazy initializer below)
  const remainingBalance = invoice
    ? (invoice.remainingBalance ?? (invoice.total - (invoice.paidAmount || 0)))
    : 0;

  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [customAmount, setCustomAmount] = useState<string>(
    () => (remainingBalance > 0 ? (remainingBalance / 2).toFixed(2) : '0')
  );
  const [step, setStep] = useState<CheckoutStep>('configure');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<InvoiceReceipt | null>(null);
  // scriptLoaded is derived from the browser state; the parent remounts this
  // component (key={invoice.id}) so checkout state resets per invoice.
  const [scriptLoaded, setScriptLoaded] = useState(
    () => typeof window !== 'undefined' && Boolean(window.Razorpay)
  );

  // Load Razorpay Checkout script dynamically (no synchronous setState in effect)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.Razorpay) return;

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      console.warn('Failed to load Razorpay checkout script');
    };
    document.body.appendChild(script);

    return () => {
      // Keep script for subsequent opens
    };
  }, []);

  if (!invoice) return null;

  const currency = invoice.currency || 'USD';
  const settleAmount =
    paymentType === 'full'
      ? remainingBalance
      : Math.min(Math.max(Number(customAmount) || 0, 1), remainingBalance);

  const handleStartPayment = async () => {
    if (!invoice) return;

    if (paymentType === 'partial') {
      const parsed = Number(customAmount);
      if (isNaN(parsed) || parsed <= 0) {
        setErrorMessage('Please enter a valid partial payment amount.');
        return;
      }
      if (parsed > remainingBalance) {
        setErrorMessage(`Amount cannot exceed the remaining balance (${formatCurrency(remainingBalance, currency)}).`);
        return;
      }
    }

    setStep('loading_order');
    setErrorMessage(null);

    try {
      // 1. Create Razorpay Order server-side
      const orderRes = await fetch('/api/payments/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          clientId: clientId || invoice.clientId,
          requestedAmount: settleAmount,
          partialPayment: paymentType === 'partial',
        }),
      });

      let orderData: any = null;
      try {
        orderData = await orderRes.json();
      } catch {
        throw new Error(`Server returned status ${orderRes.status} (${orderRes.statusText || 'Internal Error'}). Please retry.`);
      }

      if (!orderRes.ok || !orderData?.success) {
        throw new Error(orderData?.error || 'Failed to initialize payment order with server.');
      }

      // 2. Configure and open Razorpay Standard Checkout
      if (!window.Razorpay) {
        throw new Error('Razorpay payment gateway failed to load in browser. Please check your connection.');
      }

      setStep('processing');

      const options = {
        key: orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
        amount: orderData.amountSubunits,
        currency: orderData.currency,
        name: 'FlowDesk Studio',
        description: `Payment for Invoice #${invoice.invoiceNumber}`,
        image: typeof window !== 'undefined' ? `${window.location.origin}/branding/flowdesk-symbol.png` : '/branding/flowdesk-symbol.png',
        order_id: orderData.orderId,
        prefill: {
          name: orderData.clientName || invoice.clientName || '',
          email: orderData.clientEmail || invoice.clientEmail || '',
        },
        theme: {
          color: '#10b981', // Emerald theme matching FlowDesk UI
        },
        modal: {
          ondismiss: () => {
            console.info('Razorpay checkout modal closed by user');
            setStep('configure');
          },
        },
        handler: async (response: any) => {
          // 3. Checkout handler callback -> Verify server-side
          setStep('verifying');
          try {
            const verifyRes = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: response.razorpay_order_id || orderData.orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                clientId: clientId || invoice.clientId,
              }),
            });

            let verifyData: any = null;
            try {
              verifyData = await verifyRes.json();
            } catch {
              throw new Error(`Server verification error (${verifyRes.status} ${verifyRes.statusText || 'Internal Error'}).`);
            }

            if (!verifyRes.ok || !verifyData?.success) {
              throw new Error(verifyData?.error || 'Server signature verification failed.');
            }

            // 4. Payment confirmed!
            setSuccessReceipt(verifyData.receipt || null);
            setStep('success');
            if (onPaymentSuccess) {
              onPaymentSuccess(verifyData.receipt);
            }
          } catch (verifyErr: any) {
            console.error('Verification error:', verifyErr);
            setErrorMessage(verifyErr.message || 'Payment confirmation failed. Please contact support.');
            setStep('failed');
          }
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on('payment.failed', (failRes: any) => {
        console.warn('Payment failed callback:', failRes);
        setErrorMessage(
          failRes.error?.description || 'Your payment could not be processed. Please try another method.'
        );
        setStep('failed');
      });

      rzpInstance.open();
    } catch (err: any) {
      console.error('Payment checkout initiation error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during checkout setup.');
      setStep('failed');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (step !== 'processing' && step !== 'verifying') {
          onClose();
        }
      }}
      title={`Pay Securely — Statement #${invoice.invoiceNumber}`}
    >
      <div className="space-y-5 font-sans text-xs">
        {/* Step: Configure Amount & Review */}
        {step === 'configure' && (
          <div className="space-y-4">
            {/* Security Banner */}
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-semibold text-white block">256-Bit Encrypted Payment</span>
                  <span className="text-[11px] text-zinc-400">Processed securely via Razorpay</span>
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                Test Mode
              </span>
            </div>

            {/* Financial Summary */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-white/10 space-y-2.5">
              <div className="flex justify-between text-zinc-400">
                <span>Invoice Statement:</span>
                <span className="font-mono text-white font-bold">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Total Amount:</span>
                <span className="font-mono text-white font-semibold">{formatCurrency(invoice.total, currency)}</span>
              </div>
              {(invoice.paidAmount || 0) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Already Settled:</span>
                  <span className="font-mono">-{formatCurrency(invoice.paidAmount || 0, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-300 font-bold pt-2 border-t border-white/10 text-sm">
                <span>Outstanding Balance:</span>
                <span className="font-mono text-emerald-400">{formatCurrency(remainingBalance, currency)}</span>
              </div>
            </div>

            {/* Payment Options: Full vs Partial */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-zinc-300 block">Select Settlement Option:</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentType('full')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    paymentType === 'full'
                      ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-sm'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="font-bold block text-xs">Pay Full Balance</span>
                  <span className="text-[11px] font-mono text-emerald-400 mt-0.5 block">
                    {formatCurrency(remainingBalance, currency)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentType('partial')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    paymentType === 'partial'
                      ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-sm'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="font-bold block text-xs">Custom Partial</span>
                  <span className="text-[11px] text-zinc-400 mt-0.5 block">Split settlement</span>
                </button>
              </div>

              {paymentType === 'partial' && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5 mt-2">
                  <label className="text-[11px] text-zinc-300 font-semibold block">
                    Enter Amount to Pay ({currency}):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max={remainingBalance}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                      placeholder="0.00"
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 block">
                    Maximum payable: {formatCurrency(remainingBalance, currency)}
                  </span>
                </div>
              )}
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleStartPayment}
                disabled={remainingBalance <= 0}
                leftIcon={<CreditCard className="w-4 h-4" />}
              >
                Pay {formatCurrency(settleAmount, currency)}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Loading Order / Initializing */}
        {step === 'loading_order' && (
          <div className="p-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <h4 className="text-sm font-bold text-white">Initializing Secure Payment Order...</h4>
            <p className="text-xs text-zinc-400">Verifying statement balance and preparing Razorpay gateway.</p>
          </div>
        )}

        {/* Step: Processing in Checkout */}
        {step === 'processing' && (
          <div className="p-8 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto animate-pulse">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white">Razorpay Checkout Active</h4>
            <p className="text-xs text-zinc-400">
              Please complete your payment in the checkout window. Do not refresh this page.
            </p>
          </div>
        )}

        {/* Step: Verifying Signature */}
        {step === 'verifying' && (
          <div className="p-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <h4 className="text-sm font-bold text-white">Confirming Your Payment...</h4>
            <p className="text-xs text-zinc-400">Verifying cryptographic signature and generating receipt.</p>
          </div>
        )}

        {/* Step: Success State */}
        {step === 'success' && (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-white">Payment Received Successfully!</h3>
              <p className="text-xs text-zinc-300">
                Your payment of <strong className="text-emerald-400 font-mono">{formatCurrency(settleAmount, currency)}</strong> has been settled.
              </p>
            </div>

            {successReceipt && (
              <div className="p-4 rounded-xl bg-zinc-950 border border-white/10 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Receipt Reference:</span>
                  <span className="text-emerald-400 font-bold">{successReceipt.receiptNumber}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Payment Gateway:</span>
                  <span className="text-white uppercase">{successReceipt.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Payment Date:</span>
                  <span className="text-white">{successReceipt.paymentDate}</span>
                </div>
                {successReceipt.remainingBalance !== undefined && successReceipt.remainingBalance > 0 ? (
                  <div className="flex justify-between text-amber-400 pt-2 border-t border-white/10">
                    <span>Remaining Statement Balance:</span>
                    <span>{formatCurrency(successReceipt.remainingBalance, currency)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-emerald-400 pt-2 border-t border-white/10">
                    <span>Statement Status:</span>
                    <span className="font-bold">PAID IN FULL</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Step: Failed State */}
        {step === 'failed' && (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-white">Payment Could Not Be Completed</h3>
              <p className="text-xs text-rose-300">
                {errorMessage || 'Your payment was declined or cancelled. Your statement balance remains unchanged.'}
              </p>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button variant="primary" onClick={() => setStep('configure')}>
                Try Again
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
