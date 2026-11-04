import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageLayout } from '@/frontend/shared/layout/legal-page-layout';
import { siteConfig } from '@/shared/config/site-config';

export const metadata: Metadata = {
  title: 'Cancellation Policy',
  description: 'How to cancel FlowDesk subscriptions, end-of-cycle access rules, data retention upon cancellation, and fallback to the Free plan.',
  alternates: {
    canonical: '/cancellation-policy',
  },
};

const sections = [
  { id: 'how-to-cancel', title: '1. How to Cancel Your Subscription' },
  { id: 'end-of-cycle', title: '2. End-of-Cycle Access & Timing' },
  { id: 'stopping-renewals', title: '3. Stopping Auto-Renewals' },
  { id: 'fallback-to-free', title: '4. Fallback to Free Starter Tier' },
  { id: 'data-protection', title: '5. Zero Data Deletion Guarantee' },
  { id: 'over-limit-behavior', title: '6. Quota Overages & Grandfathering' },
  { id: 'resuming-subscription', title: '7. Resuming a Cancelled Plan' },
  { id: 'account-deletion', title: '8. Account Deletion vs. Subscription Cancellation' },
  { id: 'contact', title: '9. Support & Assistance' },
];

export default function CancellationPolicyPage() {
  const { cancellation } = siteConfig.policies;

  return (
    <LegalPageLayout
      title="Cancellation Policy"
      intro="FlowDesk gives you full autonomy over your workspace subscription. This policy explains step-by-step how cancellation works, how your data is protected, and what happens when your billing cycle ends."
      lastUpdated={cancellation.lastUpdated}
      version={cancellation.version}
      sections={sections}
    >
      <section id="how-to-cancel" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">1. How to Cancel Your Subscription</h2>
        <p>
          You can cancel your paid subscription (Standard or Studio) at any time directly from your workspace dashboard with no phone calls, cancellation fees, or penalties required:
        </p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Log into your FlowDesk account.</li>
          <li>Navigate to <strong>Settings</strong> and select the <strong>Billing</strong> tab.</li>
          <li>Locate the <strong>Platform Subscription</strong> card.</li>
          <li>Click the <strong>Cancel</strong> button.</li>
          <li>A confirmation modal will appear explaining that your plan will stay active until the end of your billing cycle. Confirm the cancellation.</li>
        </ol>
        <p>
          Once confirmed, your cancellation is immediately recorded on our servers and synchronized with Razorpay.
        </p>
      </section>

      <section id="end-of-cycle" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">2. End-of-Cycle Access &amp; Timing</h2>
        <p>
          In accordance with our backend architecture, subscription cancellations take effect at the <strong>conclusion of your current prepaid billing period</strong> (<code>current_period_end</code>).
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
          <p className="font-semibold text-white">Full Access Remains Active Until Period End</p>
          <p className="text-sm">
            Because you have already paid for your current monthly or annual billing cycle, your workspace retains all paid entitlements—including higher client limits, expanded storage, custom portal branding, and automated payment reminders—until the final day of your paid cycle.
          </p>
        </div>
      </section>

      <section id="stopping-renewals" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">3. Stopping Auto-Renewals</h2>
        <p>
          Cancelling your subscription automatically transmits an instruction to Razorpay to cancel the underlying recurring payment mandate (e-mandate).
        </p>
        <p>
          You will receive an in-app confirmation banner and an email notification confirming that your subscription will not renew. No further automatic debits will occur.
        </p>
      </section>

      <section id="fallback-to-free" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">4. Fallback to Free Starter Tier</h2>
        <p>
          When your paid billing period officially expires, your workspace does NOT disappear. Instead, your workspace automatically and seamlessly transitions to our <strong>Free Starter Tier</strong>.
        </p>
        <p>
          The Free Starter tier includes:
        </p>
        <ul className="list-disc pl-6 space-y-1 text-sm text-zinc-300">
          <li>Up to 2 active clients</li>
          <li>Up to 3 active projects</li>
          <li>250 MB secure document storage</li>
          <li>Up to 5 invoices per month</li>
          <li>Standard client review portal access</li>
        </ul>
      </section>

      <section id="data-protection" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">5. Zero Data Deletion Guarantee</h2>
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-sm space-y-1">
          <p className="font-semibold text-emerald-100">Your Data Is Never Deleted Upon Cancellation</p>
          <p>
            FlowDesk guarantees that cancelling a subscription will never cause your client records, deliverable versions, client comments, uploaded briefs, or historical invoices to be deleted.
          </p>
        </div>
        <p>
          All data previously created in your workspace remains safely preserved in our database and object storage. You can continue to view, inspect, print, and export your files and financial records at any time.
        </p>
      </section>

      <section id="over-limit-behavior" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">6. Quota Overages &amp; Grandfathering</h2>
        <p>
          If your workspace currently holds more data than the Free Starter tier permits (for example, you have 8 active clients, while the Starter limit is 2):
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>All Existing Records Remain Accessible:</strong> All 8 clients, their projects, and their invoices remain visible, searchable, and exportable. Existing client portals continue to operate.</li>
          <li><strong>New Creations Are Paused:</strong> You will simply be prevented from creating <em>additional</em> new clients or new projects until either you upgrade to a plan that accommodates your volume, or archive/delete unused records to align with the tier quota.</li>
          <li><strong>No Hostile Locking:</strong> We never hold your client files or invoices hostage.</li>
        </ul>
      </section>

      <section id="resuming-subscription" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">7. Resuming a Cancelled Plan</h2>
        <p>
          If you change your mind before your billing period ends, you can instantly resume your subscription with a single click in <strong>Settings &gt; Billing &gt; Resume Subscription</strong>.
        </p>
        <p>
          Resuming your subscription re-authorizes your existing recurring mandate without requiring you to re-enter payment details.
        </p>
      </section>

      <section id="account-deletion" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">8. Account Deletion vs. Subscription Cancellation</h2>
        <p>
          Please distinguish between cancelling a subscription and deleting an account:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <h4 className="font-semibold text-white">Subscription Cancellation</h4>
            <p className="text-xs text-zinc-300">Stops future charges. Reverts workspace to Free Starter tier at period end. Retains all data permanently.</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <h4 className="font-semibold text-white">Account Deletion</h4>
            <p className="text-xs text-zinc-300">Initiates complete workspace removal with a 5-day recovery window. After 5 days, all profile records, workspaces, and files are permanently purged.</p>
          </div>
        </div>
      </section>

      <section id="contact" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">9. Support &amp; Assistance</h2>
        <p>
          If you experience any difficulty managing or cancelling your subscription, please reach out to us:
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1 text-sm">
          <p><strong>Email:</strong> <a href={`mailto:${siteConfig.supportEmail}`} className="text-[#2563EB] underline">{siteConfig.supportEmail}</a></p>
          <p><strong>Contact Form:</strong> <Link href="/contact?category=Subscription%20and%20Billing" className="text-[#2563EB] underline">flowdesk.app/contact</Link></p>
          <p><strong>Response Target:</strong> Within 1 business day for subscription and billing inquiries.</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}

