import React, { useState } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { Button } from '@/frontend/shared/ui/button';
import { BILLING_PLANS, PlanKey, BillingInterval } from '@/shared/billing';
import { Check, Sparkles, Shield, AlertCircle, Loader2 } from 'lucide-react';
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
    if (planKey === 'free' || planKey === currentPlanKey) return;

    setLoadingPlan(planKey);
    setError(null);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planKey,
          interval,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to start checkout session.');
      }

      // If Razorpay SDK is available, open checkout modal
      if (typeof window !== 'undefined' && (window as any).Razorpay && data.checkoutPayload) {
        const options = {
          key: data.checkoutPayload.keyId,
          subscription_id: data.checkoutPayload.subscriptionId,
          name: 'FlowDesk Workspace',
          description: `Subscription to ${BILLING_PLANS[planKey].name} (${interval})`,
          handler: function (response: any) {
            showToast(
              'Subscription Initiated',
              'Payment authorized. Your plan entitlements will update momentarily.',
              'success'
            );
            onSuccess?.();
            onClose();
          },
          prefill: {
            name: data.checkoutPayload.customerName,
            email: data.checkoutPayload.customerEmail,
          },
          theme: {
            color: '#10b981',
          },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Mock / development confirmation
        showToast(
          'Plan Activated',
          `Workspace successfully upgraded to ${BILLING_PLANS[planKey].name}.`,
          'success'
        );
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Checkout failed. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upgrade Your Workspace"
      description="Unlock higher client limits, more storage, and custom branding."
      size="xl"
    >
      <div className="space-y-6 pt-2">
        {featureNotice && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{featureNotice}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Interval Switcher */}
        <div className="flex justify-center">
          <div className="inline-flex items-center p-1 bg-zinc-900 border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                interval === 'monthly'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setInterval('yearly')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                interval === 'yearly'
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>Yearly Billing</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-mono">
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
            const isTarget = targetPlanKey === planKey;
            const price = plan.pricing[interval].INR;

            return (
              <div
                key={planKey}
                className={`flex flex-col justify-between p-5 rounded-2xl border transition-all ${
                  isTarget || planKey === 'pro'
                    ? 'bg-white/[0.04] border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.1)]'
                    : 'bg-zinc-900/60 border-white/10'
                } ${isCurrent ? 'ring-1 ring-white/20' : ''}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-bold text-white tracking-tight">{plan.name}</span>
                    {plan.badge && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {plan.badge}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/15">
                        Current
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-zinc-400 min-h-[32px] leading-relaxed mb-4">
                    {plan.tagline}
                  </p>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-white tracking-tight">
                        ₹{price.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">
                        /{interval === 'yearly' ? 'year' : 'month'}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400">+ 18% GST</span>
                  </div>

                  {/* Limits bullets */}
                  <ul className="space-y-2 pt-3 border-t border-white/10 text-xs text-zinc-300 mb-6">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{plan.limits.activeClients} active clients</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{plan.limits.activeProjects} active projects</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{(plan.limits.storageMb / 1000).toFixed(0)} GB storage</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{plan.limits.invoicesPerMonth} invoices / month</span>
                    </li>
                    {plan.limits.brandedPortal && (
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Custom branded client portal</span>
                      </li>
                    )}
                    {plan.limits.emailReminders && (
                      <li className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
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
                      className="w-full text-xs shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                      onClick={() => handleCheckout(planKey)}
                      disabled={loadingPlan !== null}
                    >
                      {loadingPlan === planKey ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Preparing...</span>
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

        <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secure recurring payments powered by Razorpay e-Mandate</span>
          </div>
          <span>Cancel anytime from settings</span>
        </div>
      </div>
    </Modal>
  );
};
