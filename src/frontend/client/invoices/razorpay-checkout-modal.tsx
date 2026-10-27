'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { Button } from '@/frontend/shared/ui/button';
import { Invoice, InvoiceReceipt, InvoiceBranding, UserProfile } from '@/shared/types';
import { formatCurrency } from '@/shared/utils/currency';
import { QRCode } from '@/frontend/shared/ui/qr-code';
import {
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  QrCode,
  Landmark,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Send,
  FileCheck2,
} from 'lucide-react';

interface RazorpayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  clientId?: string;
  branding?: InvoiceBranding | UserProfile | null;
  onPaymentSuccess?: (receipt?: InvoiceReceipt) => void;
}

type CheckoutStep = 'configure' | 'loading_order' | 'processing' | 'verifying' | 'success' | 'failed';
type PaymentMethodTab = 'qr' | 'bank' | 'online' | 'confirm_utr';

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
  branding,
  onPaymentSuccess,
}) => {
  // Financial balance calculations
  const remainingBalance = invoice
    ? (invoice.remainingBalance ?? Math.max(0, invoice.total - (invoice.paidAmount || 0)))
    : 0;

  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [customAmount, setCustomAmount] = useState<string>(
    () => (remainingBalance > 0 ? (remainingBalance / 2).toFixed(2) : '0')
  );
  const [step, setStep] = useState<CheckoutStep>('configure');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<InvoiceReceipt | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // UTR / Payment notification form state inside modal
  const [utrNumber, setUtrNumber] = useState('');
  const [utrNotes, setUtrNotes] = useState('');
  const [isSubmittingUtr, setIsSubmittingUtr] = useState(false);
  const [utrSuccess, setUtrSuccess] = useState(false);
  const [utrError, setUtrError] = useState<string | null>(null);

  // Resolve branding and payment details
  const effectiveBranding = (branding || {}) as any;
  const invoiceBankDetails = invoice?.bankDetails || effectiveBranding.bankDetails || {};
  const bankName = invoiceBankDetails.bankName || effectiveBranding.bankName || '';
  const accountHolderName =
    invoiceBankDetails.accountHolderName ||
    effectiveBranding.accountHolderName ||
    effectiveBranding.name ||
    '';
  const accountNumber = invoiceBankDetails.accountNumber || effectiveBranding.accountNumber || '';
  const ifscCode =
    invoiceBankDetails.ifscCode ||
    invoiceBankDetails.swiftCode ||
    effectiveBranding.ifscCode ||
    '';
  const branchName = invoiceBankDetails.branchName || effectiveBranding.branchName || '';

  const upiId =
    invoice?.upiId ||
    invoiceBankDetails.upiId ||
    effectiveBranding.upiId ||
    effectiveBranding.bankDetails?.upiId ||
    '';
  const upiQrCodeUrl = invoice?.upiQrCodeUrl || effectiveBranding.upiQrCodeUrl || '';
  const payeeName =
    effectiveBranding.businessName ||
    effectiveBranding.companyName ||
    effectiveBranding.name ||
    'FlowDesk Studio';

  const hasQr = Boolean(upiQrCodeUrl || upiId);
  const hasBank = Boolean(accountNumber || bankName);

  // Active payment method tab
  const [activeTab, setActiveTab] = useState<PaymentMethodTab>(() => {
    if (hasQr) return 'qr';
    if (hasBank) return 'bank';
    return 'online';
  });

  // Copy helper
  const copyText = (text: string, fieldId: string) => {
    try {
      navigator.clipboard?.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // ignore
    }
  };

  // Load Razorpay Checkout script dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.Razorpay) return;

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onerror = () => {
      console.warn('Failed to load Razorpay checkout script');
    };
    document.body.appendChild(script);
  }, []);

  if (!invoice) return null;

  const currency = invoice.currency || 'USD';
  const settleAmount =
    paymentType === 'full'
      ? remainingBalance
      : Math.min(Math.max(Number(customAmount) || 0, 1), remainingBalance);

  const upiDeepLink = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${settleAmount}&cu=${currency === 'INR' ? 'INR' : 'INR'}&tn=${encodeURIComponent(`Invoice ${invoice.invoiceNumber}`)}`
    : '';

  // Online Razorpay Payment flow
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
        throw new Error(`Server returned status ${orderRes.status} (${orderRes.statusText || 'Internal Error'}).`);
      }

      if (!orderRes.ok || !orderData?.success) {
        throw new Error(orderData?.error || 'Failed to initialize payment order with server.');
      }

      if (!window.Razorpay) {
        throw new Error('Razorpay payment gateway failed to load in browser. Please check your connection.');
      }

      setStep('processing');

      const options = {
        key: orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
        amount: orderData.amountSubunits,
        currency: orderData.currency,
        name: payeeName,
        description: `Payment for Statement #${invoice.invoiceNumber}`,
        image: typeof window !== 'undefined' ? `${window.location.origin}/branding/flowdesk-symbol.png` : '/branding/flowdesk-symbol.png',
        order_id: orderData.orderId,
        prefill: {
          name: orderData.clientName || invoice.clientName || '',
          email: orderData.clientEmail || invoice.clientEmail || '',
        },
        theme: {
          color: '#10b981',
        },
        modal: {
          ondismiss: () => {
            console.info('Razorpay checkout modal closed by user');
            setStep('configure');
          },
        },
        handler: async (response: any) => {
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
              throw new Error(`Server verification error (${verifyRes.status}).`);
            }

            if (!verifyRes.ok || !verifyData?.success) {
              throw new Error(verifyData?.error || 'Server signature verification failed.');
            }

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
      setErrorMessage(err.message || 'Unable to open online checkout. Please use QR Code or Bank Transfer.');
      setStep('failed');
    }
  };

  // Submit UTR reference
  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrNumber.trim()) {
      setUtrError('Transaction reference or UTR number is required.');
      return;
    }

    setIsSubmittingUtr(true);
    setUtrError(null);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/notify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: settleAmount,
          paymentMethod: activeTab === 'bank' ? 'bank_transfer' : 'upi',
          transactionReference: utrNumber.trim(),
          notes: utrNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to submit payment notification');
      }

      setUtrSuccess(true);
      if (onPaymentSuccess) {
        onPaymentSuccess();
      }
    } catch (err: any) {
      setUtrError(err.message || 'Failed to submit payment verification reference.');
    } finally {
      setIsSubmittingUtr(false);
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
      size="lg"
    >
      <div className="space-y-4 font-sans text-xs">
        {/* Step: Configure & Choose Payment Method */}
        {step === 'configure' && (
          <div className="space-y-4">
            {/* Security & Statement Overview */}
            <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-mono uppercase text-zinc-400 block font-semibold">
                  Statement #{invoice.invoiceNumber}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xl font-extrabold text-white font-mono">
                    {formatCurrency(remainingBalance, currency)}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Outstanding
                  </span>
                </div>
              </div>

              {/* Full vs Partial settlement */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-950 border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setPaymentType('full')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    paymentType === 'full'
                      ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Pay Full ({formatCurrency(remainingBalance, currency)})
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('partial')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    paymentType === 'partial'
                      ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Custom Partial
                </button>
              </div>
            </div>

            {paymentType === 'partial' && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-zinc-300 font-semibold">Enter Amount to Settle ({currency}):</span>
                  <span className="text-zinc-400 font-mono text-[10px]">
                    Max: {formatCurrency(remainingBalance, currency)}
                  </span>
                </div>
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
            )}

            {/* Payment Method Selector Tabs */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-950 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('qr')}
                className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all text-xs cursor-pointer ${
                  activeTab === 'qr'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <QrCode className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Scan & Pay QR</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('bank')}
                className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all text-xs cursor-pointer ${
                  activeTab === 'bank'
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Landmark className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Bank Wire</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('online')}
                className={`py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all text-xs cursor-pointer ${
                  activeTab === 'online'
                    ? 'bg-[#176B5B]/20 border border-[#176B5B]/50 text-[#43D6B0] shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Card / Online</span>
              </button>
            </div>

            {/* TAB 1: INSTANT QR CODE PAYMENT */}
            {activeTab === 'qr' && (
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-white/10 space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* The QR Code Image / SVG */}
                  <div className="relative p-2 bg-white rounded-xl shadow-lg border border-zinc-200 w-[140px] h-[140px] flex items-center justify-center shrink-0 overflow-hidden">
                    {upiQrCodeUrl ? (
                      <img
                        src={upiQrCodeUrl}
                        alt="Payment QR Code"
                        className="w-full h-full object-contain"
                      />
                    ) : upiId ? (
                      <QRCode
                        value={upiDeepLink}
                        size={124}
                        darkColor="#000000"
                        lightColor="#ffffff"
                      />
                    ) : (
                      <div className="text-zinc-500 text-center text-[10px] p-2">
                        <QrCode className="w-8 h-8 mx-auto text-zinc-400 mb-1" />
                        No QR configured
                      </div>
                    )}
                  </div>

                  {/* QR Details & Instruction */}
                  <div className="flex-1 space-y-2.5 text-center sm:text-left w-full">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold block">
                        Instant Zero-Fee Settlement
                      </span>
                      <h4 className="text-sm font-extrabold text-white">
                        Scan with Any UPI / Banking App
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Open PhonePe, Google Pay, Paytm, BHIM, Cred or your bank app to scan.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400">Payable Amount:</span>
                        <span className="font-mono font-bold text-white text-xs">
                          {formatCurrency(settleAmount, currency)}
                        </span>
                      </div>
                      {upiId && (
                        <div className="flex items-center justify-between pt-1 border-t border-white/5">
                          <span className="text-[10px] text-zinc-400">UPI VPA:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] text-emerald-300 font-semibold">{upiId}</span>
                            <button
                              type="button"
                              onClick={() => copyText(upiId, 'upiModalVpa')}
                              className="p-1 rounded bg-white/10 hover:bg-white/20 text-zinc-200"
                              title="Copy UPI ID"
                            >
                              {copiedField === 'upiModalVpa' ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('confirm_utr')}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>I Have Completed Payment (Submit UTR)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DIRECT BANK WIRE / TRANSFER */}
            {activeTab === 'bank' && (
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-white text-xs">Direct Bank Wire Details</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Exact Amount: {formatCurrency(settleAmount, currency)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {accountHolderName && (
                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                      <span className="text-zinc-400 block text-[10px]">Beneficiary Name</span>
                      <span className="font-semibold text-zinc-200">{accountHolderName}</span>
                    </div>
                  )}

                  {bankName && (
                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                      <span className="text-zinc-400 block text-[10px]">Bank Name</span>
                      <span className="font-semibold text-zinc-200">{bankName}</span>
                    </div>
                  )}

                  {accountNumber && (
                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-zinc-400 block text-[10px]">Account Number</span>
                        <span className="font-mono font-bold text-white text-xs">{accountNumber}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(accountNumber, 'modalAccNum')}
                        className="p-1 rounded bg-white/10 hover:bg-white/20 text-zinc-200"
                        title="Copy Account Number"
                      >
                        {copiedField === 'modalAccNum' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}

                  {ifscCode && (
                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-zinc-400 block text-[10px]">IFSC / SWIFT Code</span>
                        <span className="font-mono font-bold text-white text-xs">{ifscCode}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(ifscCode, 'modalIfsc')}
                        className="p-1 rounded bg-white/10 hover:bg-white/20 text-zinc-200"
                        title="Copy IFSC"
                      >
                        {copiedField === 'modalIfsc' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}

                  {branchName && (
                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 sm:col-span-2">
                      <span className="text-zinc-400 block text-[10px]">Branch</span>
                      <span className="text-zinc-300">{branchName}</span>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('confirm_utr')}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>I Have Transferred (Submit Reference)</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: ONLINE RAZORPAY PAYMENT */}
            {activeTab === 'online' && (
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-white/10 space-y-4">
                <div className="p-3 rounded-lg bg-[#176B5B]/15 border border-[#176B5B]/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#43D6B0]" />
                    <span className="font-semibold text-[#F5F5F0]">256-Bit Encrypted Online Checkout</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#176B5B]/25 text-[#43D6B0] font-bold">
                    Credit / Debit / NetBanking
                  </span>
                </div>

                <p className="text-[#A6B4AE] text-xs">
                  Click below to open the Razorpay gateway modal. You can pay using domestic or international cards, net banking, or verified UPI accounts.
                </p>

                <Button
                  variant="primary"
                  className="w-full justify-center py-2.5 font-bold"
                  onClick={handleStartPayment}
                  disabled={remainingBalance <= 0}
                  leftIcon={<CreditCard className="w-4 h-4" />}
                >
                  Pay {formatCurrency(settleAmount, currency)} via Razorpay
                </Button>
              </div>
            )}

            {/* TAB 4: CONFIRM UTR / PAYMENT REFERENCE */}
            {activeTab === 'confirm_utr' && (
              <form onSubmit={handleSubmitUtr} className="p-4 rounded-xl bg-zinc-900/70 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    <span>Submit Payment Proof / Reference</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab(hasQr ? 'qr' : 'bank')}
                    className="text-[11px] text-zinc-400 hover:text-white"
                  >
                    Back to Details
                  </button>
                </div>

                {utrSuccess ? (
                  <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-center space-y-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                    <h4 className="text-sm font-bold text-white">Payment Reference Submitted!</h4>
                    <p className="text-xs text-zinc-300">
                      The freelancer has been notified to verify your payment. Your statement status has been updated.
                    </p>
                    <div className="pt-2">
                      <Button variant="primary" size="sm" onClick={onClose}>
                        Close
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-300 font-semibold block">
                        Transaction Reference / UTR Number: <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={utrNumber}
                        onChange={(e) => setUtrNumber(e.target.value)}
                        placeholder="e.g. 429182947192 or UPI Ref ID"
                        className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-300 font-semibold block">
                        Amount Paid ({currency}):
                      </label>
                      <input
                        type="text"
                        value={formatCurrency(settleAmount, currency)}
                        disabled
                        className="w-full bg-zinc-950/60 border border-white/5 rounded-lg px-3 py-1.5 text-zinc-400 font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-zinc-300 font-semibold block">
                        Optional Note / Bank Name:
                      </label>
                      <input
                        type="text"
                        value={utrNotes}
                        onChange={(e) => setUtrNotes(e.target.value)}
                        placeholder="e.g. Transferred from HDFC Bank"
                        className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {utrError && (
                      <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px]">
                        {utrError}
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab(hasQr ? 'qr' : 'bank')}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={isSubmittingUtr}
                        leftIcon={
                          isSubmittingUtr ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )
                        }
                      >
                        {isSubmittingUtr ? 'Submitting...' : 'Confirm Payment'}
                      </Button>
                    </div>
                  </>
                )}
              </form>
            )}

            {/* Error banner if any */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Bottom cancel action */}
            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
              <span className="text-[10px] text-zinc-500">
                Encrypted & Verified via FlowDesk Platform
              </span>
            </div>
          </div>
        )}

        {/* Step: Loading Order / Initializing */}
        {step === 'loading_order' && (
          <div className="p-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <h4 className="text-sm font-bold text-white">Initializing Secure Payment Order...</h4>
            <p className="text-xs text-zinc-400">Verifying statement balance and preparing gateway.</p>
          </div>
        )}

        {/* Step: Processing in Checkout */}
        {step === 'processing' && (
          <div className="p-8 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto animate-pulse">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white">Online Checkout Active</h4>
            <p className="text-xs text-zinc-400">
              Please complete your transaction in the checkout popup window.
            </p>
          </div>
        )}

        {/* Step: Verifying Signature */}
        {step === 'verifying' && (
          <div className="p-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <h4 className="text-sm font-bold text-white">Confirming Payment...</h4>
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

        {/* Step: Fallback / Gateway Alternative (Shows QR & Bank instead of dead-end) */}
        {step === 'failed' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Online Gateway Unavailable</span>
              </div>
              <p className="text-xs text-zinc-300">
                {errorMessage || 'Online card checkout could not be initialized.'}
              </p>
              <p className="text-[11px] text-amber-300/90 font-medium">
                You can settle this statement immediately using the QR Code or Bank Wire options below:
              </p>
            </div>

            {/* Quick QR & Bank Fallback View */}
            <div className="p-4 rounded-xl bg-zinc-900 border border-white/10 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white rounded-lg shrink-0 w-[80px] h-[80px] flex items-center justify-center overflow-hidden">
                  {upiQrCodeUrl ? (
                    <img src={upiQrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
                  ) : upiId ? (
                    <QRCode value={upiDeepLink} size={70} darkColor="#000000" lightColor="#ffffff" />
                  ) : (
                    <QrCode className="w-8 h-8 text-zinc-400" />
                  )}
                </div>
                <div className="space-y-1 text-xs">
                  <span className="font-bold text-white block">Instant QR / UPI Settlement</span>
                  <p className="text-zinc-400 text-[11px]">
                    Pay <strong className="text-white font-mono">{formatCurrency(settleAmount, currency)}</strong> directly to:
                  </p>
                  {upiId && (
                    <span className="font-mono text-emerald-400 text-[11px] block">{upiId}</span>
                  )}
                  {accountNumber && (
                    <span className="text-zinc-400 text-[10px] block">
                      A/C: <span className="font-mono text-zinc-200">{accountNumber}</span> ({bankName || 'Bank'})
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setErrorMessage(null);
                    setStep('configure');
                  }}
                >
                  Back to Options
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setErrorMessage(null);
                    setActiveTab(hasQr ? 'qr' : 'bank');
                    setStep('configure');
                  }}
                >
                  Pay via QR / Bank
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
