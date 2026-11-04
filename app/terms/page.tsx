import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageLayout } from '@/frontend/shared/layout/legal-page-layout';
import { siteConfig } from '@/shared/config/site-config';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms and conditions governing the use of the FlowDesk freelancer operating system, client portals, and billing services.',
  alternates: {
    canonical: '/terms',
  },
};

const sections = [
  { id: 'acceptance', title: '1. Acceptance of Terms' },
  { id: 'eligibility', title: '2. Eligibility & Account Security' },
  { id: 'acceptable-use', title: '3. Acceptable Use & Prohibited Activities' },
  { id: 'user-content', title: '4. User Content & Intellectual Property' },
  { id: 'client-data', title: '5. Client Data & Portal Access' },
  { id: 'plans-billing', title: '6. Subscription Plans, Billing & Taxes' },
  { id: 'payment-failures', title: '7. Payment Failures & Grace Periods' },
  { id: 'upgrades-downgrades', title: '8. Upgrades, Downgrades & Quotas' },
  { id: 'service-availability', title: '9. Service Availability & Maintenance' },
  { id: 'third-party-services', title: '10. Third-Party Integrations & Processors' },
  { id: 'liability-disclaimers', title: '11. Limitation of Liability & Statutory Rights' },
  { id: 'indemnification', title: '12. Indemnification' },
  { id: 'suspension-termination', title: '13. Suspension & Termination' },
  { id: 'governing-law', title: '14. Governing Law & Dispute Resolution' },
  { id: 'modifications', title: '15. Modifications to Terms' },
  { id: 'contact', title: '16. Contact & Grievance Redressal' },
];

export default function TermsPage() {
  const { terms } = siteConfig.policies;

  return (
    <LegalPageLayout
      title="Terms of Service"
      intro="These Terms of Service govern your access to and use of FlowDesk, including the freelancer dashboard, project management modules, itemized invoice generators, and client review portals."
      lastUpdated={terms.lastUpdated}
      version={terms.version}
      sections={sections}
    >
      <section id="acceptance" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">1. Acceptance of Terms</h2>
        <p>
          By creating an account, registering a workspace, accessing the client portal, or otherwise using the FlowDesk software platform (&quot;Service&quot;), you enter into a legally binding agreement with {siteConfig.legalEntityName} (&quot;FlowDesk&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
        </p>
        <p>
          If you are using the Service on behalf of a company, studio, agency, or other legal entity, you represent and warrant that you possess full legal authority to bind that entity to these Terms. If you do not agree to these Terms in their entirety, you must not access or use the Service.
        </p>
      </section>

      <section id="eligibility" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">2. Eligibility &amp; Account Security</h2>
        <p>
          You must be at least eighteen (18) years of age or the age of majority in your jurisdiction to register for an account. By registering, you confirm that you satisfy this requirement.
        </p>
        <p>
          When registering for a FlowDesk account, you agree to:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Provide accurate, current, and complete registration information.</li>
          <li>Maintain the security of your authentication credentials, including passwords and session tokens.</li>
          <li>Promptly notify us at <a href={`mailto:${siteConfig.securityEmail}`} className="text-[#2563EB] underline">{siteConfig.securityEmail}</a> upon discovering any unauthorized access to or compromise of your account.</li>
          <li>Accept responsibility for all activities and transactions conducted under your workspace credentials.</li>
        </ul>
      </section>

      <section id="acceptable-use" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">3. Acceptable Use &amp; Prohibited Activities</h2>
        <p>
          FlowDesk is designed for legitimate freelance business administration, client collaboration, deliverable delivery, and invoicing. You agree not to engage in any prohibited activity, including:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Uploading, transmitting, or distributing computer viruses, malware, trojans, or malicious scripts.</li>
          <li>Reverse-engineering, decompiling, or attempting to discover the source code of the Service, except where permitted by applicable law.</li>
          <li>Using automated scrapers, spiders, robots, or extraction scripts without explicit prior written authorization.</li>
          <li>Attempting to probe, scan, breach, or bypass authentication controls, Row Level Security (RLS) policies, or rate limits.</li>
          <li>Generating, issuing, or transmitting fraudulent, deceptive, or unauthorized invoices or payment collection links.</li>
          <li>Storing or transmitting content that infringes upon third-party intellectual property, privacy, or proprietary rights.</li>
          <li>Using the Service to conduct spam campaigns or unauthorized transactional email broadcasting.</li>
        </ul>
      </section>

      <section id="user-content" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">4. User Content &amp; Intellectual Property Ownership</h2>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
          <p className="font-semibold text-white">You Retain 100% Ownership of Your Work</p>
          <p>
            You retain complete, exclusive intellectual property ownership of all project files, briefs, deliverable versions, documents, invoices, trademarks, branding logos, and client communications that you upload or create on FlowDesk (&quot;User Content&quot;).
          </p>
        </div>
        <p>
          FlowDesk does not claim any ownership, title, copyright, or moral rights over your deliverables or client work.
        </p>
        <p>
          <strong>Limited Operating License:</strong> Solely to the extent necessary to provide the Service (for example, storing files on cloud storage, rendering invoices into PDF format, and displaying deliverable previews to your clients in the portal), you grant FlowDesk a worldwide, non-exclusive, royalty-free, limited license to host, copy, process, and transmit your User Content. This license terminates when you delete your content or close your account, subject to standard backup cycle purges and statutory record retention.
        </p>
      </section>

      <section id="client-data" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">5. Client Data &amp; Portal Access</h2>
        <p>
          FlowDesk allows freelancers to invite clients into dedicated review portals to inspect deliverables, submit revision comments, approve milestones, and view invoices.
        </p>
        <p>
          You represent that you have obtained all necessary consents and legal rights under applicable privacy laws (including the Digital Personal Data Protection Act, 2023) to input your clients&apos; names, contact details, and project files into FlowDesk.
        </p>
        <p>
          Clients accessing your portal are bound by portal access rules and must not abuse deliverable download or review links.
        </p>
      </section>

      <section id="plans-billing" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">6. Subscription Plans, Billing &amp; Taxes</h2>
        <p>
          FlowDesk offers subscription tiers: Starter (Free), Standard, and Studio. The quotas, capacities, and capabilities of each tier are defined in our central plan specifications and on our <Link href="/pricing" className="text-[#2563EB] underline">Pricing Page</Link>.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Recurring Billing &amp; E-Mandate:</strong> Paid subscriptions (Standard and Studio) are billed on a recurring monthly or annual basis via Razorpay recurring subscriptions. By subscribing, you authorize Razorpay to process recurring charges to your designated payment instrument at the specified billing frequency until cancelled.</li>
          <li><strong>Taxes (GST):</strong> Prices displayed in Indian Rupees (INR) exclude 18% Goods &amp; Services Tax (GST) unless indicated as inclusive. Tax invoices containing applicable GST details are made available upon successful settlement.</li>
          <li><strong>Auto-Renewal:</strong> Subscriptions automatically renew at the conclusion of each billing cycle unless cancelled prior to the renewal date via your account settings.</li>
        </ul>
      </section>

      <section id="payment-failures" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">7. Payment Failures &amp; Grace Periods</h2>
        <p>
          If a recurring subscription payment fails (e.g. expired card, insufficient funds, or bank decline):
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Your subscription status transitions to <code>past_due</code> while Razorpay automatically re-attempts debit according to banking retry schedules.</li>
          <li>If payment retries are exhausted, your workspace enters a seven (7) day <strong>Grace Period</strong> (<code>grace</code>). During this window, you will receive in-app and email payment retry notices.</li>
          <li>During the grace period, your existing data remains fully accessible and viewable. Creation of new clients or projects is paused until an active payment method is restored.</li>
          <li>Upon grace period expiration without settlement, the workspace automatically falls back to the Free Starter tier. <strong>Your existing client data and invoices are never deleted due to subscription expiration.</strong></li>
        </ul>
      </section>

      <section id="upgrades-downgrades" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">8. Upgrades, Downgrades &amp; Quotas</h2>
        <p>
          <strong>Upgrades:</strong> You may upgrade your subscription plan at any time. Higher client limits, storage allocations, and features take effect immediately upon payment confirmation.
        </p>
        <p>
          <strong>Downgrades &amp; Cancellations:</strong> Downgrades or cancellations take effect at the conclusion of the current prepaid billing period. You retain access to your plan&apos;s quotas through the end of the paid period.
        </p>
        <p>
          <strong>Grandfathered Quotas:</strong> If a downgrade or expiration causes your workspace usage (e.g. 8 active clients) to exceed the target tier limit (e.g. Starter limit of 2 clients), your existing clients and projects remain intact and accessible in read/export mode. You will simply be prevented from adding new entities until usage aligns with the tier limits.
        </p>
        <p>
          <strong>Fair Use:</strong> Tiers designated with &quot;unlimited&quot; quotas (e.g. Studio tier clients and projects) remain subject to reasonable business fair use and must not be used for bulk warehousing, unauthorized file hosting, or automated robotic abuse.
        </p>
      </section>

      <section id="service-availability" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">9. Service Availability &amp; Maintenance</h2>
        <p>
          We strive to provide continuous, high-availability service. However, scheduled maintenance, critical security updates, and unforeseen network disruptions may occasionally cause brief downtime.
        </p>
        <p>
          We will use commercially reasonable efforts to schedule routine maintenance during off-peak hours and provide advance notice when practical. FlowDesk does not warrant that the Service will be completely error-free or uninterrupted.
        </p>
      </section>

      <section id="third-party-services" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">10. Third-Party Integrations &amp; Processors</h2>
        <p>
          The Service interfaces with trusted infrastructure and payment partners:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Razorpay Software Private Limited:</strong> Handles payment gateway transactions, subscription e-mandates, and client invoice checkout. Razorpay terms and privacy policies govern gateway debit processing.</li>
          <li><strong>Supabase Inc.:</strong> Provides managed PostgreSQL database services, encrypted authentication, and object storage.</li>
          <li><strong>Brevo (Sendinblue):</strong> Delivers transactional notification emails, invoices, and invitation alerts.</li>
        </ul>
        <p>
          FlowDesk is not liable for service outages, banking processing delays, or third-party network failures originating outside our direct systems.
        </p>
      </section>

      <section id="liability-disclaimers" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">11. Limitation of Liability &amp; Statutory Rights</h2>
        <p>
          To the maximum extent permitted by applicable Indian law, FlowDesk and its officers, directors, and employees shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, contracts, business reputation, or data corruption, arising out of or related to your use of the Service.
        </p>
        <p>
          In no event shall FlowDesk&apos;s aggregate liability arising out of or related to these Terms exceed the total subscription fees paid by you to FlowDesk in the twelve (12) months preceding the incident giving rise to liability.
        </p>
        <p className="font-semibold text-white">
          Nothing in these Terms excludes, limits, or waives any statutory consumer rights or non-excludable remedies that cannot be lawfully waived under the Consumer Protection Act, 2019 or other mandatory Indian laws.
        </p>
      </section>

      <section id="indemnification" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">12. Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless FlowDesk and its affiliates from and against any third-party claims, liabilities, damages, losses, and reasonable legal expenses arising from or in connection with: (a) your breach of these Terms; (b) your User Content violating third-party rights; or (c) your willful misconduct or unlawful use of client data.
        </p>
      </section>

      <section id="suspension-termination" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">13. Suspension &amp; Termination</h2>
        <p>
          You may terminate your account at any time via Settings &gt; Security &gt; &quot;Delete Account&quot;. Freelancer accounts enter a 5-day recovery grace period before permanent data deletion.
        </p>
        <p>
          We may suspend or terminate your access immediately, with notice where practical, if you materially breach these Terms, engage in fraud, or create operational, legal, or security risk for FlowDesk or other users.
        </p>
      </section>

      <section id="governing-law" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">14. Governing Law &amp; Dispute Resolution</h2>
        <p>
          These Terms and any dispute arising out of or related to them shall be governed by and construed in accordance with the laws of <strong>{siteConfig.governingLaw.country}</strong>, without regard to conflict of law principles.
        </p>
        <p>
          In the event of any dispute, controversy, or claim, the parties shall first attempt to resolve the matter amicably through good-faith consultations. If unresolved within thirty (30) days, the dispute shall be referred to and finally resolved by arbitration administered in {siteConfig.governingLaw.arbitrationCity} in accordance with the provisions of the <em>Arbitration and Conciliation Act, 1996</em>. The arbitration proceedings shall be conducted in English by a sole arbitrator mutually agreed upon by the parties.
        </p>
        <p>
          Subject to arbitration, the courts having jurisdiction over {siteConfig.governingLaw.jurisdictionCity}, {siteConfig.governingLaw.state}, India shall have exclusive jurisdiction.
        </p>
      </section>

      <section id="modifications" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">15. Modifications to Terms</h2>
        <p>
          We may update or revise these Terms from time to time to reflect evolving regulatory requirements, feature additions, or security improvements. When material changes are made, we will notify you by updating the &quot;Last Updated&quot; date at the top of this page, through an in-app notice, or via email.
        </p>
        <p>
          Your continued use of the Service following the effective date of revised Terms constitutes your acceptance.
        </p>
      </section>

      <section id="contact" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">16. Contact &amp; Grievance Redressal</h2>
        <p>
          For general contractual inquiries, support questions, or notices regarding these Terms, please reach out to us at:
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 text-sm">
          <p><strong>Entity:</strong> {siteConfig.legalEntityName}</p>
          <p><strong>Support Email:</strong> <a href={`mailto:${siteConfig.supportEmail}`} className="text-[#2563EB] underline">{siteConfig.supportEmail}</a></p>
          <p><strong>Postal Address:</strong> {siteConfig.registeredAddress.line1}, {siteConfig.registeredAddress.city}, {siteConfig.registeredAddress.state} {siteConfig.registeredAddress.postalCode}, {siteConfig.registeredAddress.country}</p>
          <p><strong>Support Portal:</strong> <Link href="/contact" className="text-[#2563EB] underline">flowdesk.app/contact</Link></p>
        </div>
      </section>
    </LegalPageLayout>
  );
}

