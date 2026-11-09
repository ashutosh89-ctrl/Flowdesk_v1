import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageLayout } from '@/frontend/shared/layout/legal-page-layout';
import { siteConfig } from '@/shared/config/site-config';

export const metadata: Metadata = {
  title: 'Cancellation Policy',
  description: 'How to cancel FlowDesk subscriptions, end-of-period access rules, data preservation after downgrade, and switching to the Free Starter plan.',
  alternates: {
    canonical: '/cancellation-policy',
  },
};

const sections = [
  { id: 'how-to-cancel', title: '1. How to Cancel Your Subscription' },
  { id: 'effective-timing', title: '2. When Cancellation Takes Effect' },
  { id: 'switching-to-starter', title: '3. Switching to Free Starter Tier' },
  { id: 'existing-data', title: '4. Existing Data After Downgrade' },
  { id: 'custom-branding-downgrade', title: '5. Custom Branding After Downgrade' },
  { id: 'resuming-subscription', title: '6. Resuming a Subscription' },
  { id: 'account-deletion-vs-cancellation', title: '7. Account Deletion vs. Subscription Cancellation' },
  { id: 'contact', title: '8. Support and Contact' },
];

export default function CancellationPolicyPage() {
  const { cancellation } = siteConfig.policies;

  return (
    <LegalPageLayout
      title="Cancellation Policy"
      intro="FlowDesk gives you complete control over your subscription. This policy explains how self-service cancellation works, how your workspace data is preserved, and how your plan transitions at the end of a billing period."
      lastUpdated={cancellation.lastUpdated}
      version={cancellation.version}
      sections={sections}
    >
      <section id="how-to-cancel" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">1. How to Cancel Your Subscription</h2>
        <p>
          You can cancel your paid subscription (Standard or Studio) at any time directly through your workspace settings with no support phone calls, hidden hurdles, or cancellation fees:
        </p>
        <ol className="list-decimal pl-6 space-y-2 text-zinc-300">
          <li>Log into your FlowDesk account.</li>
          <li>Navigate to <strong>Settings</strong> and click the <strong>Billing</strong> tab.</li>
          <li>Locate the <strong>Platform Subscription</strong> card.</li>
          <li>Click the <strong>Cancel Subscription</strong> button.</li>
          <li>Review the cancellation modal confirming that your plan remains active until the end of your prepaid period, and confirm.</li>
        </ol>
        <p className="text-xs text-zinc-400">
          Once confirmed, your cancellation is immediately recorded on our servers and synchronized with Razorpay to cancel future recurring payment mandates.
        </p>
      </section>

      <section id="effective-timing" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">2. When Cancellation Takes Effect</h2>
        <p>
          Subscription cancellations take effect at the <strong>conclusion of your current prepaid billing period</strong> (<code>current_period_end</code>).
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
          <p className="font-semibold text-white">Full Access Remains Active Until Period End</p>
          <p className="text-sm text-zinc-300">
            Because you have already paid for your current monthly or annual cycle, your workspace retains all paid entitlements—including higher client limits, expanded invoice quotas, custom portal branding, and automated reminders—until the final day of your paid period.
          </p>
        </div>
        <p className="text-sm text-zinc-300">
          Cancelling immediately cancels the recurring e-mandate in Razorpay, ensuring that no subsequent charges or automatic debits will occur.
        </p>
      </section>

      <section id="switching-to-starter" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">3. Switching to Free Starter Tier</h2>
        <p>
          When your paid billing period officially concludes, your workspace does <strong>not</strong> get deleted. Instead, your account automatically and seamlessly transitions to the <strong>Free Starter Tier</strong> (₹0 forever).
        </p>
        <p>
          The Free Starter tier includes:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-sm text-zinc-300">
          <li>Up to 2 active clients</li>
          <li>Up to 3 active projects</li>
          <li>Up to 5 invoices per month</li>
          <li>Local device storage (zero cloud caps)</li>
          <li>Standard FlowDesk client portal branding</li>
        </ul>
      </section>

      <section id="existing-data" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">4. Existing Data After Downgrade</h2>
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-sm space-y-1">
          <p className="font-semibold text-emerald-100">Your Existing Data Is Never Deleted Upon Cancellation</p>
          <p>
            FlowDesk guarantees that cancelling a subscription will never delete your clients, past invoices, deliverable records, client comments, or historical data.
          </p>
        </div>
        <p>
          If your workspace currently holds more active entities than the Free Starter tier permits (for example, you have 7 active clients while Starter permits 2):
        </p>
        <ul className="list-disc pl-6 space-y-2 text-zinc-300">
          <li><strong>Existing Records Remain Fully Accessible:</strong> All 7 clients, their projects, deliverables, and invoices remain visible, searchable, and exportable. Existing client portals continue to operate.</li>
          <li><strong>New Creations Are Paused:</strong> You will simply be prevented from creating <em>additional</em> new clients or projects until either you upgrade to a plan accommodating your volume, or archive/delete inactive records to align with the tier limit.</li>
          <li><strong>No Hostile Locking:</strong> We never hold your client files or invoices hostage.</li>
        </ul>
      </section>

      <section id="custom-branding-downgrade" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">5. Custom Branding After Downgrade</h2>
        <p>
          If you uploaded a custom studio logo and signature during your Standard or Studio subscription:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-zinc-300">
          <li><strong>Assets Are Safely Preserved:</strong> Your custom logo and signature files remain saved in your workspace settings; they are not deleted.</li>
          <li><strong>Portal Branding on Starter:</strong> While your workspace operates on the Free Starter tier, public client portals and invoices display standard FlowDesk branding.</li>
          <li><strong>Automatic Restoration on Upgrade:</strong> If you re-upgrade to Standard or Studio in the future, your custom logo and signature are automatically restored to your client portals without requiring you to re-upload.</li>
        </ul>
      </section>

      <section id="resuming-subscription" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">6. Resuming a Subscription</h2>
        <p>
          If you cancel your subscription and later decide to reactivate paid capabilities, you can re-subscribe at any time directly from <strong>Settings &gt; Billing</strong>.
        </p>
        <p>
          Selecting a plan and completing checkout will immediately restore higher client and invoice quotas, custom branding, and premium automation features.
        </p>
      </section>

      <section id="account-deletion-vs-cancellation" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">7. Account Deletion vs. Subscription Cancellation</h2>
        <p>
          Please note the fundamental distinction between cancelling a subscription and deleting an account:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <h4 className="font-semibold text-white">Subscription Cancellation</h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Stops future recurring charges. Transitions workspace to Free Starter tier at the end of the paid billing period. All workspace records, client lists, deliverables, and invoices are permanently preserved.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <h4 className="font-semibold text-white">Account Deletion</h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Initiates permanent removal of your entire account, workspaces, and stored assets. Includes a 5-day recovery grace period to cancel deletion. After 5 days, all data is permanently purged and unrecoverable.
            </p>
          </div>
        </div>
      </section>

      <section id="contact" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">8. Support and Contact</h2>
        <p>
          If you experience any difficulties managing or cancelling your subscription, please reach out to our support team:
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5 text-xs text-zinc-300">
          <p><strong>Email:</strong> <a href={`mailto:${siteConfig.supportEmail}`} className="text-[#43D6B0] hover:underline font-mono">{siteConfig.supportEmail}</a></p>
          <p><strong>Contact Form:</strong> <Link href="/contact?category=Subscription%20and%20Billing" className="text-[#43D6B0] hover:underline">https://www.flow-desk.live/contact?category=Subscription and Billing</Link></p>
          <p><strong>Response Target:</strong> Within 1 business day for billing and subscription inquiries</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
