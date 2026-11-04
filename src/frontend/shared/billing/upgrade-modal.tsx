import React, { useState } from 'react';
import Link from 'next/link';
import { Modal } from '@/frontend/shared/ui/modal';
import { Button } from '@/frontend/shared/ui/button';
import { BILLING_PLANS, PlanKey, BillingInterval } from '@/shared/billing';
import { Check, Zap, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';

export interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlanKey?: PlanKey;
  targetPlanKey?: PlanKey;
  featureNotice?: string;
  onSuccess?: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  currentPlanKey = 'free',
  targetPlanKey,
  featureNotice,
  onSuccess,
}) => {
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleCheckout = async (planKey: PlanKey) => {
    try {
      setLoadingPlan(planKey);
      setError(null);

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey,
          interval,
          notes: { client_portal: 'flowdesk_freelancer' },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate checkout session');
      }

      // Check if Razorpay is loaded
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay({
          key: data.keyId,
          subscription_id: data.subscriptionId,
          name: 'FlowDesk Studio',
          description: `${BILLING_PLANS[planKey].name} Plan Subscription`,
          handler: function (response: any) {
            showToast('Upgrade Successful', 'Your workspace limits have been updated.', 'success');
            onSuccess?.();
            onClose();
          },
          theme: {
            color: '#176B5B',
          },
        });

        rzp.on('payment.failed', function (response: any) {
          setError(response.error?.description || 'Payment authorization failed');
        });

        rzp.open();
      } else {
        // Fallback for demo / preview environments without Razorpay SDK injected
        if (data.shortUrl) {
          window.location.href = data.shortUrl;
        } else {
          showToast(
            'Subscription Created',
            `Subscription ID ${data.subscriptionId} initiated in test mode.`,
            'info'
          );
          onSuccess?.();
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Subscription checkout failed');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upgrade Workspace Plan" size="xl">
      <div className="space-y-6">
        {featureNotice && (
          <div className="flex items-center gap-2 p-3 bg-[#176B5B]/15 border border-[#176B5B]/40 rounded-xl text-xs text-[#F5F5F0]">
            <Zap className="w-4 h-4 text-[#43D6B0] shrink-0" />
            <span>{featureNotice}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Interval Switcher */}
        <div className="flex justify-center">
          <div className="inline-flex items-center p-1 bg-[#101312] border border-[#176B5B]/30 rounded-xl">
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                interval === 'monthly'
                  ? 'bg-[#176B5B]/30 text-[#F5F5F0] shadow-sm'
                  : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setInterval('yearly')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                interval === 'yearly'
                  ? 'bg-[#176B5B]/30 text-[#F5F5F0] shadow-sm'
                  : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
              }`}
            >
              <span>Yearly Billing</span>
              <span className="text-[10px] bg-[#176B5B]/20 text-[#43D6B0] px-1.5 py-0.5 rounded-full font-mono">
                Save ~16%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['free', 'pro', 'studio'] as PlanKey[]).map((planKey) => {
            const plan = BILLING_PLANS[planKey];
            const isCurrent = currentPlanKey === planKey;
            const price = plan.pricing[interval].INR;

            return (
              <div
                key={planKey}
                className={`flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 bg-[#191F1D] border-[#176B5B]/30 hover:border-[#43D6B0]/60 hover:shadow-[0_4px_24px_rgba(23,107,91,0.2)] focus-within:border-[#43D6B0]/60 ${
                  isCurrent ? 'ring-1 ring-[#43D6B0]/40' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-bold text-[#F5F5F0] tracking-tight">{plan.name}</span>
                    {plan.badge && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#176B5B]/20 text-[#43D6B0] border border-[#176B5B]/30">
                        {plan.badge}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#176B5B]/20 text-[#43D6B0] border border-[#176B5B]/30">
                        Current
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#A6B4AE] min-h-[32px] leading-relaxed mb-4">
                    {plan.tagline}
                  </p>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-[#F5F5F0] tracking-tight">
                        ₹{price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-[#A6B4AE] font-mono">
                        /{interval === 'yearly' ? 'year' : 'month'}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#A6B4AE]">+ 18% GST (Tax Invoice Included)</span>
                  </div>

                  {/* Limits bullets */}
                  <ul className="space-y-2 pt-3 border-t border-[#176B5B]/20 text-xs text-[#A6B4AE] mb-6">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#43D6B0] shrink-0" />
                      <span>
                        {plan.limits.activeClients >= 1000
                          ? 'Unlimited active clients (fair use)'
                          : `${plan.limits.activeClients} active clients`}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#43D6B0] shrink-0" />
                      <span>
                        {plan.limits.activeProjects >= 1000
                          ? 'Unlimited active projects'
                          : `${plan.limits.activeProjects} active projects`}
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#43D6B0] shrink-0" />
                      <span>{(plan.limits.storageMb / 1000).toFixed(0)} GB storage</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#43D6B0] shrink-0" />
                      <span>{plan.limits.invoicesPerMonth} invoices / month</span>
                    </li>
                    {plan.limits.brandedPortal && (
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#43D6B0] shrink-0" />
                        <span>Custom branded client portal</span>
                      </li>
                    )}
                    {plan.limits.emailReminders && (
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-[#43D6B0] shrink-0" />
                        <span>Automated payment reminders</span>
                      </li>
                    )}
                  </ul>
                </div>

                <div>
                  {isCurrent ? (
                    <Button variant="secondary" className="w-full text-xs" disabled>
                      Current Plan
                    </Button>
                  ) : planKey === 'free' ? (
                    <Button variant="secondary" className="w-full text-xs" disabled>
                      Default Tier
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      className="w-full text-xs"
                      onClick={() => handleCheckout(planKey)}
                      disabled={loadingPlan !== null}
                    >
                      {loadingPlan === planKey ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Connecting...</span>
                        </div>
                      ) : (
                        `Upgrade to ${plan.name}`
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Policy Links & Razorpay e-Mandate disclosure */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-[#A6B4AE] pt-3 border-t border-[#176B5B]/20 gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[#43D6B0]" />
            <span>Secure recurring payments powered by Razorpay e-Mandate</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <Link href="/terms" target="_blank" className="hover:text-white underline">Terms</Link>
            <span>•</span>
            <Link href="/refund-policy" target="_blank" className="hover:text-white underline">Refunds</Link>
            <span>•</span>
            <Link href="/cancellation-policy" target="_blank" className="hover:text-white underline">Cancellations</Link>
          </div>
        </div>
      </div>
    </Modal>
  );
};
