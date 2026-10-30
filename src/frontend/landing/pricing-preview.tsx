'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/frontend/shared/ui/button';
import { BILLING_PLANS, PlanKey, BillingInterval } from '@/shared/billing';
import { Check, ArrowRight } from 'lucide-react';

export interface PricingPreviewProps {
  onOpenAuth: (view: 'signup' | 'login') => void;
  onLaunchApp: () => void;
}

export const PricingPreview: React.FC<PricingPreviewProps> = ({ onOpenAuth }) => {
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  return (
    <section id="pricing" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-3xl mx-auto mb-14 space-y-3"
      >
        <h2 className="text-3xl sm:text-5xl font-extrabold text-[#F5F5F0] tracking-tight leading-tight">
          Simple, Transparent Pricing
        </h2>
        <p className="text-base sm:text-lg text-[#A6B4AE] max-w-2xl mx-auto leading-relaxed">
          Start for free, then upgrade as your clients and projects grow.
        </p>

        {/* Interval Selector */}
        <div className="pt-4 flex justify-center">
          <div className="inline-flex items-center p-1 bg-[#16181B] border border-white/[0.08] rounded-xl">
            <button
              type="button"
              onClick={() => setInterval('monthly')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                interval === 'monthly'
                  ? 'bg-[#43D6B0] text-[#0D0E10]'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setInterval('yearly')}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                interval === 'yearly'
                  ? 'bg-[#43D6B0] text-[#0D0E10]'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              <span>Yearly</span>
              <span className={`text-xs font-mono ${interval === 'yearly' ? 'text-[#0D0E10]' : 'text-[#43D6B0]'}`}>
                (Save ~16%)
              </span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* 3-Column Plan Cards Sourced from BILLING_PLANS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(['free', 'pro', 'studio'] as PlanKey[]).map((planKey) => {
          const plan = BILLING_PLANS[planKey];
          const price = plan.pricing[interval].INR;
          const isPopular = planKey === 'pro';

          return (
            <motion.div
              key={planKey}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`flex flex-col justify-between p-7 sm:p-8 rounded-2xl transition-colors duration-200 relative ${
                isPopular
                  ? 'bg-[#181C1A] border-2 border-[#43D6B0] shadow-2xl'
                  : 'bg-[#16181B] border border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xl font-bold text-[#F8F9FA] tracking-tight">{plan.name}</h3>
                  {isPopular && (
                    <span className="px-3 py-1 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider bg-[#43D6B0] text-[#0D0E10]">
                      Popular
                    </span>
                  )}
                </div>

                <p className="text-sm text-[#9CA3AF] leading-relaxed mb-6 min-h-[44px]">
                  {plan.tagline}
                </p>

                <div className="mb-6 pb-6 border-b border-white/[0.08]">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl sm:text-5xl font-extrabold text-[#F8F9FA] tracking-tight">
                      ₹{price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-sm text-[#9CA3AF] font-mono">
                      /{interval === 'yearly' ? 'yr' : 'mo'}
                    </span>
                  </div>
                  <span className="text-xs text-[#9CA3AF] font-mono mt-1 block">
                    {price > 0 ? '+ 18% GST (Tax Invoice Included)' : 'Free forever'}
                  </span>
                </div>

                <ul className="space-y-3 text-sm text-[#A6B4AE] mb-8">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#43D6B0] shrink-0 mt-0.5" />
                      <span className="leading-snug text-[#F5F5F0]/90">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <Button
                  variant={isPopular ? 'primary' : 'secondary'}
                  size="lg"
                  className="w-full text-base font-semibold py-3.5"
                  onClick={() => onOpenAuth('signup')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {planKey === 'free' ? 'Start for Free' : planKey === 'pro' ? 'Get Pro — ₹799/mo' : 'Choose Studio'}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
