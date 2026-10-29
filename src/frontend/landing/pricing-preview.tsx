import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/frontend/shared/ui/button';
import { BILLING_PLANS, PlanKey, BillingInterval } from '@/shared/billing';
import { Check, ArrowRight } from 'lucide-react';

export interface PricingPreviewProps {
  onOpenAuth: (view: 'signup' | 'login') => void;
  onLaunchApp: () => void;
}

export const PricingPreview: React.FC<PricingPreviewProps> = ({ onOpenAuth, onLaunchApp }) => {
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  return (
    <section id="pricing" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-3xl mx-auto mb-14 space-y-4"
      >
        <h2 className="text-3xl sm:text-5xl font-extrabold text-[#F5F5F0] tracking-tight leading-tight">
          Plans That Grow With Your Freelance Business
        </h2>
        <p className="text-base sm:text-xl text-[#A6B4AE] max-w-2xl mx-auto leading-relaxed font-normal">
          Start free with the essentials. Upgrade to Pro when you scale your client work.
        </p>

        {/* Interval Selector */}
        <div className="pt-4 flex justify-center">
          <div className="inline-flex items-center p-1.5 bg-[#141816] border border-[#212B27] rounded-xl">
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                interval === 'monthly'
                  ? 'bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/60 shadow-sm'
                  : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setInterval('yearly')}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                interval === 'yearly'
                  ? 'bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/60 shadow-sm'
                  : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
              }`}
            >
              <span>Yearly Billing</span>
              <span className="text-[11px] bg-[#43D6B0]/15 text-[#43D6B0] border border-[#43D6B0]/30 px-2 py-0.5 rounded-full font-mono font-medium">
                Save ~16%
              </span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* 3-Column Plan Cards Sourced from BILLING_PLANS with ₹799 Highlighted */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {(['free', 'pro', 'studio'] as PlanKey[]).map((planKey) => {
          const plan = BILLING_PLANS[planKey];
          const price = plan.pricing[interval].INR;
          const isPopular = planKey === 'pro'; // Highlight 799 Pro plan as popular
          const ctaLabel =
            planKey === 'free'
              ? 'Start for Free'
              : planKey === 'pro'
              ? 'Get Pro Freelancer'
              : 'Choose Studio';

          return (
            <motion.div
              key={planKey}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`relative flex flex-col justify-between p-6 sm:p-8 rounded-2xl transition-all duration-200 ${
                isPopular
                  ? 'bg-[#161D1A] border-2 border-[#43D6B0] shadow-[0_12px_40px_rgba(0,0,0,0.6),0_0_24px_rgba(67,214,176,0.12)] -translate-y-1'
                  : 'bg-[#141816] border border-[#212B27] hover:border-[#43D6B0]/40'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-3.5 py-1 rounded-full bg-[#43D6B0] text-[#101312] text-xs font-bold uppercase tracking-wider shadow-md">
                    Most Popular
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-[#F5F5F0] tracking-tight">{plan.name}</h3>
                </div>

                <p className="text-sm text-[#A6B4AE] leading-relaxed mb-6 min-h-[44px] font-normal">
                  {plan.tagline}
                </p>

                <div className="mb-6 pb-6 border-b border-[#212B27]">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-5xl font-extrabold text-[#F5F5F0] tracking-tight">
                      ₹{price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-sm text-[#A6B4AE] font-mono">
                      /{interval === 'yearly' ? 'yr' : 'mo'}
                    </span>
                  </div>
                  <span className="text-xs text-[#A6B4AE] font-mono mt-1.5 block">
                    {price > 0 ? '+ 18% GST (Tax Invoice Included)' : 'Free forever'}
                  </span>
                </div>

                <ul className="space-y-3 text-sm text-[#A6B4AE] mb-8 font-normal">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#43D6B0] shrink-0 mt-0.5" />
                      <span className="leading-snug text-[#A6B4AE]">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Button
                  variant={isPopular ? 'primary' : 'secondary'}
                  size="lg"
                  className={`w-full text-base font-bold py-3.5 transition-all ${
                    isPopular
                      ? 'bg-[#43D6B0] text-[#101312] hover:bg-[#38c29e] shadow-md'
                      : 'bg-[#101312] text-[#F5F5F0] border border-[#212B27] hover:border-[#43D6B0]/50'
                  }`}
                  onClick={() => onOpenAuth('signup')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {ctaLabel}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
