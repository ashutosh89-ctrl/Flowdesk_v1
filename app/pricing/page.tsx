import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageLayout } from '@/frontend/shared/layout/legal-page-layout';
import { Button } from '@/frontend/shared/ui/button';
import { BILLING_PLANS } from '@/shared/billing';
import { Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { siteConfig } from '@/shared/config/site-config';

export const metadata: Metadata = {
  title: 'Pricing & Plans | FlowDesk',
  description: 'Simple, transparent pricing for independent freelancers and studios. Start with Starter (₹0) or upgrade to Standard (₹399/mo) and Studio (₹899/mo).',
  alternates: {
    canonical: '/pricing',
  },
};

export default function PricingPage() {
  const starter = BILLING_PLANS.starter;
  const standard = BILLING_PLANS.standard;
  const studio = BILLING_PLANS.studio;

  return (
    <LegalPageLayout
      title="Transparent Plans for Independent Professionals"
      intro="Start for free with essential freelancer operations tools. Upgrade to Standard or Studio as your client base, active projects, and operational throughput expand."
      version={siteConfig.policies.terms.version}
      lastUpdated={siteConfig.policies.terms.lastUpdated}
      sections={[
        { id: 'plan-cards', title: '1. Plans & Subscription Rates' },
        { id: 'feature-matrix', title: '2. Detailed Feature Matrix' },
        { id: 'taxes-billing', title: '3. Taxes, Billing & Invoicing' },
        { id: 'cancellation-terms', title: '4. Cancellation & Zero Data Deletion Guarantee' },
      ]}
    >
      {/* Plan Cards Grid */}
      <section id="plan-cards" className="space-y-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">1. Plans &amp; Subscription Rates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 not-prose">
          {/* Starter Plan */}
          <div className="p-6 rounded-3xl bg-[#111111]/90 border border-[#2A2A2A] flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-2xl font-bold text-white tracking-tight">{starter.name}</h3>
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/10 text-zinc-300 border border-white/15">
                  Free Forever
                </span>
              </div>
              <p className="text-xs text-zinc-400 min-h-[36px]">{starter.tagline}</p>

              <div className="my-5 pb-5 border-b border-[#2A2A2A]">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white tracking-tight">₹0</span>
                  <span className="text-xs text-zinc-400 font-mono">/forever</span>
                </div>
                <span className="text-xs text-emerald-400 font-mono mt-1 block">Free for solo creators</span>
              </div>

              <ul className="space-y-2.5 text-xs text-zinc-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Up to 2 active clients</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Up to 3 active projects</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Local device storage (Zero cloud caps)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Up to 5 invoices per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Standard client review portal</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Basic payment tracking</span>
                </li>
              </ul>
            </div>

            <Link href="/signup">
              <Button variant="secondary" className="w-full text-xs font-semibold py-3">
                Start for Free
              </Button>
            </Link>
          </div>

          {/* Standard Plan */}
          <div className="p-6 rounded-3xl bg-[#111111] border border-[#2563EB]/60 shadow-[0_10px_40px_rgba(0,71,171,0.2)] flex flex-col justify-between space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[#0047AB] text-white text-[10px] font-mono uppercase px-3 py-1 rounded-bl-xl font-bold tracking-wider">
              Most Popular
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-2xl font-bold text-white tracking-tight">{standard.name}</h3>
              </div>
              <p className="text-xs text-zinc-400 min-h-[36px]">{standard.tagline}</p>

              <div className="my-5 pb-5 border-b border-[#2A2A2A]">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white tracking-tight">₹399</span>
                  <span className="text-xs text-zinc-400 font-mono">/month</span>
                </div>
                <div className="flex items-center justify-end mt-1">
                  <span className="text-[11px] text-zinc-400 font-mono">₹3,990/year (~16% off)</span>
                </div>
              </div>

              <ul className="space-y-2.5 text-xs text-zinc-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Up to 15 active clients</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Up to 25 active projects</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Local device storage (Zero cloud caps)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>50 invoices per month with auto-numbering</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Custom branded client portal</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Automated invoice payment reminders</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Multi-currency invoicing &amp; payment receipts</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Priority email support</span>
                </li>
              </ul>
            </div>

            <Link href="/signup">
              <Button variant="primary" className="w-full text-xs font-semibold py-3 shadow-[0_0_20px_rgba(0,71,171,0.4)]" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Choose Standard
              </Button>
            </Link>
          </div>

          {/* Studio Plan */}
          <div className="p-6 rounded-3xl bg-[#111111]/90 border border-[#2A2A2A] flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-2xl font-bold text-white tracking-tight">{studio.name}</h3>
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#0047AB]/20 text-[#E8F0FF] border border-[#2563EB]/30">
                  High Capacity
                </span>
              </div>
              <p className="text-xs text-zinc-400 min-h-[36px]">{studio.tagline}</p>

              <div className="my-5 pb-5 border-b border-[#2A2A2A]">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white tracking-tight">₹899</span>
                  <span className="text-xs text-zinc-400 font-mono">/month</span>
                </div>
                <div className="flex items-center justify-end mt-1">
                  <span className="text-[11px] text-zinc-400 font-mono">₹8,990/year (~16% off)</span>
                </div>
              </div>

              <ul className="space-y-2.5 text-xs text-zinc-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Up to 100 active clients</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Up to 150 active projects</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Local device storage (Zero cloud caps)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>500 invoices per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Fully branded client experience &amp; custom subpaths</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Automated multi-stage dunning &amp; invoice reminders</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>High-throughput deliverable versioning</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Dedicated support &amp; audit log exports</span>
                </li>
              </ul>
            </div>

            <Link href="/signup">
              <Button variant="secondary" className="w-full text-xs font-semibold py-3">
                Choose Studio
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Matrix Table */}
      <section id="feature-matrix" className="space-y-4 pt-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">2. Detailed Feature Matrix</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-white/10 rounded-2xl overflow-hidden">
            <thead className="bg-white/[0.04] text-white font-mono uppercase text-[11px]">
              <tr>
                <th className="p-3.5 border-b border-white/10">Feature / Quota</th>
                <th className="p-3.5 border-b border-white/10">Starter (₹0)</th>
                <th className="p-3.5 border-b border-white/10">Standard (₹399/mo)</th>
                <th className="p-3.5 border-b border-white/10">Studio (₹899/mo)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-zinc-300">
              <tr>
                <td className="p-3.5 font-medium text-white">Active Clients</td>
                <td className="p-3.5">2</td>
                <td className="p-3.5 font-semibold text-white">15</td>
                <td className="p-3.5 font-semibold text-white">100</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Active Projects</td>
                <td className="p-3.5">3</td>
                <td className="p-3.5 font-semibold text-white">25</td>
                <td className="p-3.5 font-semibold text-white">150</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Storage Architecture</td>
                <td className="p-3.5">Local device storage (Zero cloud caps)</td>
                <td className="p-3.5 font-semibold text-white">Local device storage (Zero cloud caps)</td>
                <td className="p-3.5 font-semibold text-white">Local device storage (Zero cloud caps)</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Monthly Invoices</td>
                <td className="p-3.5">5</td>
                <td className="p-3.5 font-semibold text-white">50</td>
                <td className="p-3.5 font-semibold text-white">500</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Invoice Auto-Numbering</td>
                <td className="p-3.5 text-zinc-500">Default numbering only</td>
                <td className="p-3.5 text-emerald-400">Custom prefix, padding &amp; sequence</td>
                <td className="p-3.5 text-emerald-400">Custom prefix, padding &amp; sequence</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Payment Tracking</td>
                <td className="p-3.5">Basic manual payment tracking</td>
                <td className="p-3.5 font-semibold text-white">Advanced ledger &amp; receipts</td>
                <td className="p-3.5 font-semibold text-white">Advanced ledger &amp; receipts</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Payment Receipts</td>
                <td className="p-3.5 text-zinc-500">—</td>
                <td className="p-3.5 text-emerald-400">Automated client receipts</td>
                <td className="p-3.5 text-emerald-400">Automated client receipts</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Automated Payment Reminders</td>
                <td className="p-3.5 text-zinc-500">Manual Only</td>
                <td className="p-3.5 text-emerald-400">Yes (Automated Email)</td>
                <td className="p-3.5 text-emerald-400">Yes (Automated Email)</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Automated Multi-Stage Dunning</td>
                <td className="p-3.5 text-zinc-500">—</td>
                <td className="p-3.5 text-zinc-500">—</td>
                <td className="p-3.5 text-emerald-400">Yes (Escalating multi-interval dunning)</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Multi-Currency Invoicing</td>
                <td className="p-3.5 text-zinc-500">INR Base Currency Only</td>
                <td className="p-3.5 text-emerald-400">Multi-Currency (INR, USD, EUR, etc.)</td>
                <td className="p-3.5 text-emerald-400">Multi-Currency (INR, USD, EUR, etc.)</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Client Review Portal</td>
                <td className="p-3.5">Standard review portal</td>
                <td className="p-3.5">Standard review portal</td>
                <td className="p-3.5">Standard review portal</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Custom Portal Branding</td>
                <td className="p-3.5 text-zinc-500">Default FlowDesk Branding</td>
                <td className="p-3.5 text-emerald-400">Custom Logo, Signature &amp; Colors</td>
                <td className="p-3.5 text-emerald-400">Fully Branded Studio Experience</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Custom Subpaths / Slugs</td>
                <td className="p-3.5 text-zinc-500">—</td>
                <td className="p-3.5 text-zinc-500">—</td>
                <td className="p-3.5 text-emerald-400">Custom portal join slug (/portal/join/...)</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Deliverable Versioning</td>
                <td className="p-3.5">Up to 3 versions / deliverable</td>
                <td className="p-3.5">Up to 5 versions / deliverable</td>
                <td className="p-3.5 text-emerald-400">High-Throughput Versioning (Unlimited)</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Audit Log Exports</td>
                <td className="p-3.5 text-zinc-500">—</td>
                <td className="p-3.5 text-zinc-500">—</td>
                <td className="p-3.5 text-emerald-400">Forensic CSV/JSON Audit Log Exports</td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Support Level</td>
                <td className="p-3.5">Community &amp; Self-Serve</td>
                <td className="p-3.5 font-semibold text-white">Priority Email Support</td>
                <td className="p-3.5 font-semibold text-white">Dedicated Support Desk</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Taxes & Billing Policies */}
      <section id="taxes-billing" className="space-y-4 pt-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">3. Taxes, Billing &amp; Invoicing</h2>
        <p className="text-sm">
          {siteConfig.registration.taxStatement}
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 text-xs text-zinc-300">
          <p><strong>Payment Gateway:</strong> All recurring subscription debits are processed securely via Razorpay recurring e-mandates.</p>
          <p><strong>Billing Cycle:</strong> You may choose Monthly or Annual billing. Annual plans include a ~16% discount over monthly billing.</p>
          <p><strong>Receipts:</strong> Invoices with your business name and GST identification (if provided in your profile) are issued for every subscription payment.</p>
        </div>
      </section>

      {/* Cancellation & Zero Data Deletion Guarantee */}
      <section id="cancellation-terms" className="space-y-4 pt-6 border-t border-[#2A2A2A]">
        <h2 className="text-2xl font-bold text-white tracking-tight">4. Cancellation &amp; Zero Data Deletion Guarantee</h2>
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs sm:text-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-emerald-100">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Cancel Anytime &bull; No Hostile Locking</span>
          </div>
          <p>
            You can cancel your subscription from your settings dashboard at any time. Your plan remains fully active until the end of the paid billing period.
          </p>
          <p>
            When your paid period ends, your workspace automatically reverts to the Free Starter plan. <strong>Your existing data is never deleted</strong>. All client records, deliverables, and invoices remain intact and accessible.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <span>&bull;</span>
            <Link href="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link>
            <span>&bull;</span>
            <Link href="/cancellation-policy" className="hover:text-white transition-colors">Cancellation Policy</Link>
          </div>
          <Link href="/contact">
            <span className="text-[#2563EB] hover:underline">Have questions about pricing? Contact Us &rarr;</span>
          </Link>
        </div>
      </section>
    </LegalPageLayout>
  );
}
