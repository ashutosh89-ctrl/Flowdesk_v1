import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageLayout } from '@/frontend/shared/layout/legal-page-layout';
import { siteConfig } from '@/shared/config/site-config';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms and conditions governing the use of the FlowDesk freelance operating system, client portals, and billing services.',
  alternates: {
    canonical: '/terms',
  },
};

const sections = [
  { id: 'about-flowdesk', title: '1. About FlowDesk' },
  { id: 'using-flowdesk', title: '2. Using FlowDesk' },
  { id: 'acceptable-use', title: '3. Acceptable Use' },
  { id: 'user-content-ownership', title: '4. User Content and Ownership' },
  { id: 'client-information', title: '5. Client Information' },
  { id: 'plans-and-payments', title: '6. Plans and Payments' },
  { id: 'subscription-renewal', title: '7. Subscription Renewal and Payment' },
  { id: 'plan-changes-downgrades', title: '8. Plan Changes and Downgrades' },
  { id: 'service-availability', title: '9. Service Availability' },
  { id: 'third-party-services', title: '10. Third-Party Services' },
  { id: 'account-suspension-deletion', title: '11. Account Suspension and Deletion' },
  { id: 'changes-and-contact', title: '12. Changes and Contact' },
];

export default function TermsPage() {
  const { terms } = siteConfig.policies;

  return (
    <LegalPageLayout
      title="Terms of Service"
      intro="These Terms of Service outline the rules, responsibilities, and conditions governing your use of FlowDesk. By registering for or using FlowDesk, you agree to these terms."
      lastUpdated={terms.lastUpdated}
      version={terms.version}
      sections={sections}
    >
      <section id="about-flowdesk" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">1. About FlowDesk</h2>
        <p>
          FlowDesk is an independent software platform designed to help freelancers and digital creative professionals organize and run their client operations. FlowDesk provides software tools to manage:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-zinc-300">
          <li>Clients and contact relationships</li>
          <li>Projects and task milestones</li>
          <li>Deliverables, revision cycles, and asset reviews</li>
          <li>Client reviews, feedback, and formal sign-offs</li>
          <li>Invoices and payment status tracking</li>
          <li>Client portals with dedicated access links</li>
          <li>Workspace settings, custom branding, and workflow operations</li>
        </ul>
        <p>
          FlowDesk acts as software infrastructure to facilitate collaboration and record-keeping between freelancers and their clients. FlowDesk is not an employer, employment agency, recruiting service, or escrow agent.
        </p>
      </section>

      <section id="using-flowdesk" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">2. Using FlowDesk</h2>
        <p>
          To access the platform, you must create a workspace account. When registering for and using FlowDesk, you agree to:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-zinc-300">
          <li>Provide accurate, truthful, and up-to-date registration information.</li>
          <li>Maintain the confidentiality and security of your login credentials and authentication tokens.</li>
          <li>Take full responsibility for all activities, data entries, and communications conducted through your workspace account.</li>
          <li>Promptly notify us at <a href={`mailto:${siteConfig.supportEmail}`} className="text-[#43D6B0] hover:underline font-mono">{siteConfig.supportEmail}</a> if you detect or suspect any unauthorized access or security breach affecting your account.</li>
        </ul>
      </section>

      <section id="acceptable-use" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">3. Acceptable Use</h2>
        <p>
          You agree to use FlowDesk only for lawful business purposes and in compliance with all applicable laws and regulations. You must not:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-zinc-300">
          <li>Engage in fraudulent, deceptive, or misleading activities.</li>
          <li>Upload, share, or transmit viruses, malware, trojans, or harmful software code.</li>
          <li>Attempt unauthorized access to other workspaces, server infrastructure, or private network endpoints.</li>
          <li>Bypass or attempt to bypass account security controls, authentication safeguards, or subscription plan restrictions.</li>
          <li>Generate, distribute, or issue fraudulent invoices, unauthorized payment links, or deceptive billing demands.</li>
          <li>Violate third-party intellectual property, privacy, or proprietary rights.</li>
          <li>Abuse client portals, messaging tools, or invitation features to transmit unsolicited communications (spam).</li>
          <li>Use the platform for any unlawful, harassing, or harmful activity.</li>
        </ul>
      </section>

      <section id="user-content-ownership" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">4. User Content and Ownership</h2>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
          <p className="font-semibold text-white">You Retain Full Ownership of Your Work</p>
          <p className="text-sm text-zinc-300">
            You retain 100% intellectual property ownership of all project files, briefs, deliverables, documents, invoices, trademarks, logos, and communications that you upload or create using FlowDesk (&quot;User Content&quot;).
          </p>
        </div>
        <p>
          FlowDesk does not claim any ownership, title, copyright, or moral rights over your freelance deliverables, invoices, client documents, or custom branding assets.
        </p>
        <p>
          <strong>Limited Operational Permission:</strong> You grant FlowDesk only the limited, non-exclusive permissions strictly necessary to operate the service, render and display shared content to your clients, generate documents (such as PDF invoices), and deliver the features you request. This permission ceases when you delete your content or close your account, subject to standard system deletion timelines.
        </p>
        <p>
          <strong>Local Deliverable Storage:</strong> Deliverable files are stored directly on your local device and served via secure local file protocols or authorized direct transfers. FlowDesk does not impose cloud storage caps on your local device deliverables.
        </p>
      </section>

      <section id="client-information" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">5. Client Information</h2>
        <p>
          As a freelancer using FlowDesk, you are responsible for the client data you enter into the platform (such as client names, business affiliations, and email addresses).
        </p>
        <p>
          You represent that you have obtained all necessary permissions and consents required by applicable privacy laws to input client details, send invitations, and share deliverables or invoices through FlowDesk client portals.
        </p>
      </section>

      <section id="plans-and-payments" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">6. Plans and Payments</h2>
        <p>
          FlowDesk offers three subscription tiers designed for different stages of freelance practice:
        </p>
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center justify-between">
              <span>Free Starter</span>
              <span className="font-mono text-sm text-[#43D6B0]">₹0 / month</span>
            </h3>
            <p className="text-xs text-zinc-400">Essential tools for solo freelancers starting out.</p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-300">
              <li>2 active clients</li>
              <li>3 active projects</li>
              <li>5 invoices per month</li>
              <li>Local device storage (zero cloud caps)</li>
              <li>Default FlowDesk client portal branding</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center justify-between">
              <span>Standard Freelancer</span>
              <span className="font-mono text-sm text-[#43D6B0]">₹399 / month &bull; ₹3,990 / year</span>
            </h3>
            <p className="text-xs text-zinc-400">Advanced tools for full-time professionals scaling client work.</p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-300">
              <li>15 active clients</li>
              <li>25 active projects</li>
              <li>50 invoices per month</li>
              <li>Custom invoice auto-numbering</li>
              <li>Custom branded client portal (custom logo &amp; signature)</li>
              <li>Automated payment reminders</li>
              <li>Multi-currency invoicing and receipts</li>
              <li>Priority email support</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <h3 className="text-base font-semibold text-white flex items-center justify-between">
              <span>Studio Agency</span>
              <span className="font-mono text-sm text-[#43D6B0]">₹899 / month &bull; ₹8,990 / year</span>
            </h3>
            <p className="text-xs text-zinc-400">High-capacity workspace for boutique agencies and top-tier studios.</p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-zinc-300">
              <li>100 active clients</li>
              <li>150 active projects</li>
              <li>500 invoices per month</li>
              <li>Custom portal subpaths</li>
              <li>Multi-stage payment dunning automation</li>
              <li>Deliverable versioning and comparison tools</li>
              <li>Dedicated support and audit log exports</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-zinc-400 pt-2">
          All subscription fees are denominated in Indian Rupees (INR). FlowDesk is operated as an independent software platform and does not claim GST registration or issue GST tax invoices.
        </p>
      </section>

      <section id="subscription-renewal" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">7. Subscription Renewal and Payment</h2>
        <p>
          Paid subscriptions (Standard and Studio) are billed in advance on a recurring monthly or annual basis via Razorpay recurring payments and e-mandates.
        </p>
        <p>
          By starting a paid subscription, you authorize automatic recurring charges to your designated payment method at the agreed billing frequency until you cancel.
        </p>
        <p>
          You may cancel future renewals at any time directly through your workspace settings (<strong>Settings &gt; Billing &gt; Cancel Subscription</strong>). Once cancelled, no further recurring charges will occur.
        </p>
      </section>

      <section id="plan-changes-downgrades" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">8. Plan Changes and Downgrades</h2>
        <p>
          <strong>Upgrades:</strong> You can upgrade your subscription at any time. Higher limits and premium capabilities take effect immediately upon successful payment confirmation.
        </p>
        <p>
          <strong>Downgrades and Cancellations:</strong> Downgrades and subscription cancellations take effect at the end of your current prepaid billing period. Your workspace retains all paid entitlements through the final day of your paid cycle.
        </p>
        <p>
          <strong>Data Retention on Starter:</strong> When your subscription transitions to the Free Starter tier, your existing client records, active projects, deliverable history, and past invoices are safely preserved and remain viewable. If your current volume exceeds Starter limits (for example, you have 6 clients while Starter allows 2), you will not be able to create <em>new</em> clients or projects until your active count aligns with the tier limit or you choose to re-upgrade.
        </p>
        <p>
          <strong>Branding Retention:</strong> Custom branding assets (such as your uploaded logo and signature) remain stored safely in your workspace settings. While on the Free Starter tier, public client portals display default FlowDesk branding; if you re-upgrade to Standard or Studio, your custom branding is immediately restored without needing to re-upload.
        </p>
      </section>

      <section id="service-availability" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">9. Service Availability</h2>
        <p>
          We employ commercially reasonable efforts to maintain reliable, secure, and continuous platform availability.
        </p>
        <p>
          However, scheduled maintenance, system upgrades, emergency security patches, and unforeseen network or infrastructure disruptions may occasionally cause service interruptions. FlowDesk does not warrant that the service will be completely error-free or uninterrupted at all times.
        </p>
      </section>

      <section id="third-party-services" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">10. Third-Party Services</h2>
        <p>
          FlowDesk integrates with trusted third-party service providers to deliver key platform functionality:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-zinc-300">
          <li><strong>Razorpay:</strong> Handles subscription payments, checkout processing, and recurring payment mandates.</li>
          <li><strong>Brevo:</strong> Dispatches transactional emails, client invitations, milestone alerts, and invoice payment reminders.</li>
          <li><strong>Supabase:</strong> Provides managed database infrastructure, data encryption, and user authentication services.</li>
        </ul>
        <p>
          FlowDesk is not responsible or liable for outages, delays, or service failures caused by third-party systems or external network providers outside our direct control.
        </p>
      </section>

      <section id="account-suspension-deletion" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">11. Account Suspension and Deletion</h2>
        <p>
          FlowDesk reserves the right to suspend or terminate access to your account if you materially breach these Terms, engage in fraud, abuse platform resources, or create legal or operational risk.
        </p>
        <p>
          You may delete your account at any time via <strong>Settings &gt; Security &gt; Delete Account</strong>. When you request account deletion, your account enters a <strong>5-day recovery grace period</strong> during which you can reverse the deletion by logging back in. If not restored within 5 days, your workspace, profile records, and stored assets are permanently deleted from active systems.
        </p>
      </section>

      <section id="changes-and-contact" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">12. Changes and Contact</h2>
        <p>
          We may update these Terms of Service periodically to reflect product enhancements, legal updates, or changes in operations. Notice of material changes will be published on this page with an updated &quot;Last Updated&quot; date.
        </p>
        <p>
          Your continued use of FlowDesk after changes are published signifies your acceptance of the revised Terms.
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 text-sm mt-4">
          <p className="font-semibold text-white">Questions or Feedback?</p>
          <p>
            If you have questions about these Terms of Service, please reach out to us:
          </p>
          <ul className="space-y-1 text-xs">
            <li><strong>Email:</strong> <a href={`mailto:${siteConfig.supportEmail}`} className="text-[#43D6B0] hover:underline font-mono">{siteConfig.supportEmail}</a></li>
            <li><strong>Support Page:</strong> <Link href="/contact" className="text-[#43D6B0] hover:underline">https://flowdesk-v1.vercel.app/contact</Link></li>
          </ul>
        </div>
      </section>
    </LegalPageLayout>
  );
}
