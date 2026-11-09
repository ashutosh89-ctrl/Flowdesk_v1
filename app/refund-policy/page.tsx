import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageLayout } from '@/frontend/shared/layout/legal-page-layout';
import { siteConfig } from '@/shared/config/site-config';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'FlowDesk SaaS subscription refund policy, duplicate charge investigation guidelines, and resolution procedures.',
  alternates: {
    canonical: '/refund-policy',
  },
};

const sections = [
  { id: 'general-policy', title: '1. General Refund Policy' },
  { id: 'billing-errors', title: '2. Billing Errors & Duplicate Debits' },
  { id: 'cancellation-refunds', title: '3. Cancellation & Refunds' },
  { id: 'freelancer-client-payments', title: '4. Freelancer-to-Client Invoice Payments' },
  { id: 'refund-request-process', title: '5. Refund Request Process' },
  { id: 'refund-processing', title: '6. Refund Processing & Timelines' },
  { id: 'legal-rights', title: '7. Statutory Consumer Rights' },
  { id: 'contact', title: '8. Contact Information' },
];

export default function RefundPolicyPage() {
  const { refund } = siteConfig.policies;

  return (
    <LegalPageLayout
      title="Refund Policy"
      intro="This Refund Policy details how subscription cancellations, billing corrections, duplicate payment inquiries, and refund requests are handled for FlowDesk workspaces."
      lastUpdated={refund.lastUpdated}
      version={refund.version}
      sections={sections}
    >
      <section id="general-policy" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">1. General Refund Policy</h2>
        <p>
          FlowDesk provides cloud-based workspace software on a subscription basis. Paid subscriptions (Standard at ₹399/month or ₹3,990/year, and Studio at ₹899/month or ₹8,990/year) are billed in advance at the start of each billing cycle.
        </p>
        <p>
          <strong>General Policy:</strong> Subscription payments are final and non-refundable once the billing period has commenced.
        </p>
        <p>
          To ensure every freelancer can evaluate FlowDesk before committing financially, we provide a <strong>Free Starter Tier</strong> (₹0 forever) that includes full access to core workspace tools, client portals, deliverable review flows, and invoice generation. Because the free tier allows thorough evaluation prior to upgrading, FlowDesk does not offer discretionary refunds for change of mind, partial billing periods, or lack of usage.
        </p>
      </section>

      <section id="billing-errors" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">2. Billing Errors &amp; Duplicate Debits</h2>
        <p>
          We are committed to fair and accurate billing. We will promptly investigate and issue a full refund in the following verified circumstances:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-zinc-300">
          <li><strong>Duplicate Debits:</strong> Technical double charges resulting from gateway latency, network timeout anomalies, or duplicate payment attempts.</li>
          <li><strong>Post-Cancellation Renewal:</strong> A subscription charge occurring after a cancellation was properly confirmed in your workspace settings prior to the renewal date.</li>
          <li><strong>Proven Unauthorized Billing:</strong> Verified fraudulent charges reported promptly with supporting verification.</li>
        </ul>
      </section>

      <section id="cancellation-refunds" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">3. Cancellation &amp; Refunds</h2>
        <p>
          Cancelling your paid subscription stops future recurring renewal charges.
        </p>
        <p>
          Cancellation does <strong>not</strong> automatically trigger a retroactive or prorated refund for the active prepaid billing cycle. Your workspace retains full access to your paid tier&apos;s quotas and features until the conclusion of your current billing period (<code>current_period_end</code>). At that point, the workspace automatically transitions to the Free Starter tier.
        </p>
      </section>

      <section id="freelancer-client-payments" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">4. Freelancer-to-Client Invoice Payments</h2>
        <p>
          FlowDesk is a business management and invoicing tool, <strong>not</strong> an escrow agent or a party to commercial contracts between freelancers and their clients.
        </p>
        <p>
          Any payments made by your clients to you—whether through direct UPI transfers, bank account deposits, or payment gateway links specified on your invoices—are direct commercial transactions between you and your client. FlowDesk does not hold, process, mediate, or refund funds paid for freelance deliverables or client invoices. Any disputes regarding invoice amounts or client deliverables must be resolved directly between the freelancer and the client.
        </p>
      </section>

      <section id="refund-request-process" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">5. Refund Request Process</h2>
        <p>
          If you believe you have experienced a billing error or duplicate debit, please submit a refund request using the following steps:
        </p>
        <ol className="list-decimal pl-6 space-y-3 text-zinc-300">
          <li>
            <strong>Open the Support Request Form:</strong> Visit our dedicated contact form with the refund category selected: <Link href="/contact?category=Refund%20Request" className="text-[#43D6B0] hover:underline font-mono">www.flow-desk.live/contact?category=Refund Request</Link>, or email <a href={`mailto:${siteConfig.supportEmail}`} className="text-[#43D6B0] hover:underline font-mono">{siteConfig.supportEmail}</a>.
          </li>
          <li>
            <strong>Provide Transaction Details:</strong> Include your registered workspace email address, the date of the charge, the amount, and the Razorpay payment or subscription ID (e.g. <code>pay_...</code> or <code>sub_...</code>).
          </li>
          <li>
            <strong>Describe the Issue:</strong> Briefly describe the nature of the billing issue (such as &quot;Duplicate charge for Standard monthly subscription on November 7&quot;).
          </li>
          <li>
            <strong>Review Window:</strong> Our billing support team reviews and responds to refund inquiries within <strong>1 to 2 business days</strong>.
          </li>
        </ol>
      </section>

      <section id="refund-processing" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">6. Refund Processing &amp; Timelines</h2>
        <p>
          Approved refunds are processed through Razorpay directly back to the <strong>original payment method</strong> used during checkout (credit card, debit card, UPI, or net banking).
        </p>
        <p>
          Once initiated by FlowDesk, banking networks and payment providers typically credit the funds to your account within <strong>5 to 7 business days</strong>, depending on your card issuer or bank&apos;s settlement cycle. FlowDesk cannot accelerate bank processing timelines once a refund has been issued through the gateway.
        </p>
      </section>

      <section id="legal-rights" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">7. Statutory Consumer Rights</h2>
        <p>
          Nothing in this Refund Policy excludes, limits, or modifies any non-waivable statutory consumer rights, mandatory guarantees, or statutory legal remedies that cannot be lawfully waived under applicable consumer protection legislation.
        </p>
      </section>

      <section id="contact" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">8. Contact Information</h2>
        <p>
          For billing questions, payment verifications, or refund inquiries, please contact our support team:
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5 text-xs text-zinc-300">
          <p><strong>Email:</strong> <a href={`mailto:${siteConfig.supportEmail}`} className="text-[#43D6B0] hover:underline font-mono">{siteConfig.supportEmail}</a></p>
          <p><strong>Contact Form:</strong> <Link href="/contact?category=Refund%20Request" className="text-[#43D6B0] hover:underline">https://www.flow-desk.live/contact?category=Refund Request</Link></p>
          <p><strong>Response Target:</strong> Within 1 to 2 business days for billing matters</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}
