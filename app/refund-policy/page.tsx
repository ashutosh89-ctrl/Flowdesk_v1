import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageLayout } from '@/frontend/shared/layout/legal-page-layout';
import { siteConfig } from '@/shared/config/site-config';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'FlowDesk SaaS subscription refund policy, duplicate payment correction guidelines, and request procedures.',
  alternates: {
    canonical: '/refund-policy',
  },
};

const sections = [
  { id: 'general-policy', title: '1. General Subscription Refund Policy' },
  { id: 'billing-errors', title: '2. Duplicate Payments & Billing Errors' },
  { id: 'cancellation-relationship', title: '3. Relationship Between Cancellation & Refunds' },
  { id: 'request-procedure', title: '4. Step-by-Step Refund Request Procedure' },
  { id: 'processing-timing', title: '5. Refund Processing & Payment Method' },
  { id: 'client-invoices', title: '6. Freelancer-to-Client Invoice Payments' },
  { id: 'statutory-rights', title: '7. Statutory Consumer Rights' },
  { id: 'contact', title: '8. Contact Information' },
];

export default function RefundPolicyPage() {
  const { refund } = siteConfig.policies;

  return (
    <LegalPageLayout
      title="Refund Policy"
      intro="This Refund Policy details how subscription cancellations, accidental duplicate charges, and billing corrections are handled for FlowDesk SaaS workspaces."
      lastUpdated={refund.lastUpdated}
      version={refund.version}
      sections={sections}
    >
      <section id="general-policy" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">1. General Subscription Refund Policy</h2>
        <p>
          FlowDesk provides cloud-based software services. When you subscribe to a paid plan (Standard or Studio), subscription fees are billed in advance at the start of your billing cycle (monthly or yearly).
        </p>
        <p>
          <strong>General Rule:</strong> Subscription fees are generally non-refundable once a billing cycle has commenced, except where explicitly required by applicable law or where a billing error is confirmed by our support team.
        </p>
        <p>
          Because FlowDesk provides a free Starter tier (₹0 forever) allowing freelancers to fully evaluate the core features, client portal, deliverable review system, and invoice generator prior to upgrading, we do not offer discretionary refunds for change of mind or lack of usage during an active cycle.
        </p>
      </section>

      <section id="billing-errors" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">2. Duplicate Payments &amp; Billing Errors</h2>
        <p>
          We take payment accuracy seriously. We will gladly investigate and issue a full refund in cases involving:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Duplicate Debits:</strong> Technical double-charging or dual debits resulting from network lag or gateway retry anomalies.</li>
          <li><strong>Erroneous Tier Renewal:</strong> Subscriptions that were properly scheduled for cancellation prior to the renewal date but debited due to webhook synchronization delays.</li>
          <li><strong>Proven Unauthorized Charges:</strong> Fraudulent transactions reported promptly with supporting verification.</li>
        </ul>
      </section>

      <section id="cancellation-relationship" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">3. Relationship Between Cancellation &amp; Refunds</h2>
        <p>
          Cancelling your paid subscription does NOT automatically trigger a retroactive refund for the current billing cycle.
        </p>
        <p>
          When you cancel a subscription in your account settings, your plan remains active with full write permissions and allocated quotas until the scheduled end of your prepaid period (<code>current_period_end</code>). Future auto-renewals are stopped immediately, and no subsequent charges will occur.
        </p>
      </section>

      <section id="request-procedure" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">4. Step-by-Step Refund Request Procedure</h2>
        <p>
          If you believe you have experienced an erroneous charge or duplicate debit, please follow these steps:
        </p>
        <ol className="list-decimal pl-6 space-y-3">
          <li>
            <strong>Open the Support Request Form:</strong> Navigate to our dedicated contact page with the refund category pre-selected: <Link href="/contact?category=Refund%20Request" className="text-[#2563EB] underline font-semibold">flowdesk.app/contact?category=Refund Request</Link>.
          </li>
          <li>
            <strong>Provide Order Details:</strong> Enter your registered workspace email address, the transaction date, and the Razorpay payment or subscription ID (e.g. <code>sub_...</code> or <code>pay_...</code>).
          </li>
          <li>
            <strong>Describe the Issue:</strong> Briefly describe the nature of the billing anomaly (e.g. &quot;Charged twice on Nov 4 for Standard monthly renewal&quot;).
          </li>
          <li>
            <strong>Review Window:</strong> Our billing team investigates refund inquiries within <strong>one (1) business day</strong>.
          </li>
        </ol>
      </section>

      <section id="processing-timing" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">5. Refund Processing &amp; Payment Method</h2>
        <p>
          Approved refunds are processed through our payment gateway (Razorpay) directly back to the <strong>original payment method</strong> used during checkout (credit card, debit card, net banking, or UPI account).
        </p>
        <p>
          <strong>Settlement Timing:</strong> Once authorized by FlowDesk, banking networks typically credit the funds back to your account within <strong>5 to 7 business days</strong>, depending on your issuing bank&apos;s settlement schedule.
        </p>
      </section>

      <section id="client-invoices" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">6. Freelancer-to-Client Invoice Payments</h2>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
          <p className="font-semibold text-white">Important Notice Regarding Freelancer Client Invoices</p>
          <p className="text-sm">
            FlowDesk provides software tools enabling freelancers to issue invoices and record client payments. Invoices issued by freelancers to their respective clients represent independent commercial contracts between the freelancer and client.
          </p>
          <p className="text-sm">
            FlowDesk is not a party to freelancer-client service contracts and does not mediate, hold in escrow, or refund fees paid by clients directly to freelancers for professional freelance services.
          </p>
        </div>
      </section>

      <section id="statutory-rights" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">7. Statutory Consumer Rights</h2>
        <p>
          Nothing in this Refund Policy is intended to exclude, restrict, or modify any statutory rights or statutory consumer warranties you may hold under the <em>Consumer Protection Act, 2019</em> or other applicable Indian laws that cannot be lawfully waived by contract.
        </p>
      </section>

      <section id="contact" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">8. Contact Information</h2>
        <p>
          For billing questions, payment inquiries, or refund assistance:
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1 text-sm">
          <p><strong>Email:</strong> <a href={`mailto:${siteConfig.supportEmail}`} className="text-[#2563EB] underline">{siteConfig.supportEmail}</a></p>
          <p><strong>Support Portal:</strong> <Link href="/contact?category=Refund%20Request" className="text-[#2563EB] underline">Submit a Refund Request</Link></p>
          <p><strong>Response Target:</strong> Within 1 business day for payment issues</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}

