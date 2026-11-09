import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageLayout } from '@/frontend/shared/layout/legal-page-layout';
import { siteConfig } from '@/shared/config/site-config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How FlowDesk collects, uses, stores, and protects personal information across our freelance management platform and client portals.',
  alternates: {
    canonical: '/privacy',
  },
};

const sections = [
  { id: 'introduction', title: '1. Introduction' },
  { id: 'information-collected', title: '2. Information We Collect' },
  { id: 'how-we-use-information', title: '3. How We Use Information' },
  { id: 'payment-information', title: '4. Payment Information' },
  { id: 'information-sharing', title: '5. Information Sharing' },
  { id: 'data-storage-security', title: '6. Data Storage and Security' },
  { id: 'data-retention-deletion', title: '7. Data Retention and Deletion' },
  { id: 'privacy-requests-rights', title: '8. Privacy Requests and Rights' },
  { id: 'childrens-data', title: '9. Children’s Personal Data' },
  { id: 'cookies-technologies', title: '10. Cookies and Essential Technologies' },
  { id: 'changes-and-contact', title: '11. Policy Changes and Contact' },
];

export default function PrivacyPage() {
  const { privacy } = siteConfig.policies;

  return (
    <LegalPageLayout
      title="Privacy Policy"
      intro="This Privacy Policy explains how FlowDesk collects, handles, stores, and safeguards personal information when you use our freelance management platform, itemized invoice generators, and client portals."
      lastUpdated={privacy.lastUpdated}
      version={privacy.version}
      sections={sections}
    >
      <section id="introduction" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">1. Introduction</h2>
        <p>
          FlowDesk is an independently operated software platform built for freelancers and creative studios. We respect your privacy and are committed to handling your personal information transparently, honestly, and responsibly.
        </p>
        <p>
          This policy applies to information collected through the FlowDesk web application, freelancer workspaces, client portals, and related support channels.
        </p>
      </section>

      <section id="information-collected" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">2. Information We Collect</h2>
        <p>
          We collect only information that is necessary to provide, secure, and improve our services:
        </p>
        <div className="space-y-4 pt-1">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1.5 text-sm">
            <h3 className="font-semibold text-white">Account Information</h3>
            <p className="text-xs text-zinc-300">
              When you register for FlowDesk, we collect your name, email address, and account password. Password authentication is handled securely via Supabase Auth using industry-standard hashing; plain-text passwords are never accessible to FlowDesk.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1.5 text-sm">
            <h3 className="font-semibold text-white">Workspace &amp; Invoicing Details</h3>
            <p className="text-xs text-zinc-300">
              You may optionally configure your workspace with your freelance business name, contact details, currency preferences, and payment receipt instructions (such as a UPI ID or bank transfer account numbers) so your clients know where to send payments on your invoices.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1.5 text-sm">
            <h3 className="font-semibold text-white">Client Information</h3>
            <p className="text-xs text-zinc-300">
              To collaborate with clients, you provide client names, contact emails, and company names. This information is used strictly to grant portal access, deliver notifications, and generate invoices on your behalf.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1.5 text-sm">
            <h3 className="font-semibold text-white">Projects, Deliverables &amp; Invoices</h3>
            <p className="text-xs text-zinc-300">
              Project titles, milestone statuses, deliverable version labels, feedback comments, invoice line items, amounts, and settlement states are stored in your workspace. Deliverable source files themselves reside on your local device.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1.5 text-sm">
            <h3 className="font-semibold text-white">Custom Branding Assets</h3>
            <p className="text-xs text-zinc-300">
              On eligible paid tiers (Standard and Studio), you may upload a custom studio logo and signature image to brand your invoices and client portals.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1.5 text-sm">
            <h3 className="font-semibold text-white">Technical &amp; Log Data</h3>
            <p className="text-xs text-zinc-300">
              When you interact with the service, our servers automatically record basic diagnostic information including browser type, IP address, device type, session timestamps, and error logs necessary for system health and abuse mitigation.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs sm:text-sm mt-4">
          <strong>Payment &amp; Financial Data Clarity:</strong> FlowDesk does NOT collect, handle, or store raw credit card or debit card numbers, card verification values (CVV), net banking credentials, or government tax identifiers (such as PAN or GSTIN) unless you explicitly choose to include them as custom text on your own invoice templates.
        </div>
      </section>

      <section id="how-we-use-information" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">3. How We Use Information</h2>
        <p>
          We use the information we collect solely for legitimate product and operational purposes:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-zinc-300">
          <li>Operating, maintaining, and delivering FlowDesk features and workspace tools.</li>
          <li>Authenticating your account and verifying authorized workspace access.</li>
          <li>Generating PDF invoices and managing client review portals.</li>
          <li>Dispatching transactional emails, including client invitation links, milestone notifications, and invoice payment reminders.</li>
          <li>Detecting, preventing, and addressing fraud, security threats, or unauthorized access attempts.</li>
          <li>Responding to your support requests, inquiries, and technical issues.</li>
        </ul>
      </section>

      <section id="payment-information" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">4. Payment Information</h2>
        <p>
          Subscription billing for paid FlowDesk tiers (Standard and Studio) is handled exclusively by <strong>Razorpay</strong>, an authorized and PCI-DSS Level 1 compliant payment aggregator.
        </p>
        <p>
          When you subscribe, your payment details (credit card, debit card, UPI mandate, or net banking credentials) are entered directly into Razorpay&apos;s secure checkout interface. FlowDesk never receives, processes, or stores your full card details or banking credentials. Razorpay securely tokenizes your payment instrument and provides FlowDesk with an opaque subscription identifier for billing status management.
        </p>
      </section>

      <section id="information-sharing" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">5. Information Sharing</h2>
        <p className="font-semibold text-white">
          FlowDesk does NOT sell, rent, or trade your personal information or your clients&apos; information to any third party, advertiser, or data broker.
        </p>
        <p>
          We share data only with trusted infrastructure providers strictly necessary to operate our service:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-zinc-300">
          <li><strong>Supabase:</strong> Provides managed database hosting, database encryption, and authentication services.</li>
          <li><strong>Brevo:</strong> Provides transactional email delivery infrastructure for notifications, portal invitations, and payment reminders.</li>
          <li><strong>Razorpay:</strong> Processes platform subscription checkout and recurring e-mandates.</li>
        </ul>
        <p>
          In addition, client portal information (such as project milestones and invoices) is shared only with the specific clients you explicitly invite into that portal.
        </p>
      </section>

      <section id="data-storage-security" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">6. Data Storage and Security</h2>
        <p>
          FlowDesk implements industry-standard technical and operational safeguards to protect your personal data:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-zinc-300">
          <li><strong>Transport Security:</strong> All web traffic and API calls are encrypted in transit using modern HTTPS and TLS protocols.</li>
          <li><strong>Database Encryption:</strong> Stored workspace metadata is protected by AES-256 encryption at rest.</li>
          <li><strong>Multi-Tenant Isolation:</strong> We enforce Supabase Row Level Security (RLS) policies at the database layer to ensure that each workspace&apos;s data is strictly isolated from all other workspaces.</li>
          <li><strong>Access Controls:</strong> Server-side authorization checks verify workspace ownership before any data read or mutation is processed.</li>
        </ul>
        <p className="text-xs text-zinc-400">
          <strong>Honest Security Disclosure:</strong> FlowDesk is operated as an independent software platform and does not claim unverified third-party certifications (such as ISO 27001 or SOC 2 Type II) that have not been formally audited by an accredited registrar. While we maintain rigorous, defense-in-depth security practices, no internet-transmitted or cloud-stored system can guarantee absolute 100% immunity from all potential vulnerabilities.
        </p>
      </section>

      <section id="data-retention-deletion" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">7. Data Retention and Deletion</h2>
        <p>
          We retain your account and workspace data for as long as your FlowDesk account remains active.
        </p>
        <p>
          <strong>Account Deletion &amp; 5-Day Grace Period:</strong> You can delete your account at any time from your settings (<strong>Settings &gt; Security &gt; Delete Account</strong>). Upon requesting deletion:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-zinc-300">
          <li>Your account enters a <strong>5-day recovery grace period</strong> during which public access is suspended, but you can cancel deletion simply by logging back in.</li>
          <li>If the deletion is not cancelled within 5 days, our automated deletion service permanently purges your account records, workspaces, clients, invoices, and uploaded branding assets from active databases.</li>
        </ul>
      </section>

      <section id="privacy-requests-rights" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">8. Privacy Requests and Rights</h2>
        <p>
          You have direct control over your personal information:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-zinc-300">
          <li><strong>Access &amp; Correction:</strong> You can review and update your name, email address, workspace settings, and invoice preferences directly in your FlowDesk dashboard.</li>
          <li><strong>Data Export:</strong> You can export your clients, projects, and invoice records at any time.</li>
          <li><strong>Account Deletion:</strong> You can initiate account deletion at any time from your settings or request manual assistance.</li>
        </ul>
        <p>
          To submit a privacy inquiry, request data assistance, or withdraw consent, contact our support team at <a href={`mailto:${siteConfig.supportEmail}`} className="text-[#43D6B0] hover:underline font-mono">{siteConfig.supportEmail}</a> or use our support form at <Link href="/contact?category=Privacy%20and%20Data%20Deletion" className="text-[#43D6B0] hover:underline">https://www.flow-desk.live/contact?category=Privacy and Data Deletion</Link>. We acknowledge and process privacy requests within 2 business days.
        </p>
      </section>

      <section id="childrens-data" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">9. Children’s Personal Data</h2>
        <p>
          FlowDesk is a business productivity tool intended for freelance professionals and creative service providers. We do not knowingly collect or solicit personal data from children under applicable statutory age limits.
        </p>
        <p>
          If a parent or legal guardian discovers that their child has provided personal information to FlowDesk without appropriate parental consent, please contact us immediately at <a href={`mailto:${siteConfig.supportEmail}`} className="text-[#43D6B0] hover:underline font-mono">{siteConfig.supportEmail}</a> and we will take immediate steps to remove the information and terminate the account.
        </p>
      </section>

      <section id="cookies-technologies" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">10. Cookies and Essential Technologies</h2>
        <p>
          FlowDesk uses only essential cookies and local storage technologies strictly required to operate the platform:
        </p>
        <ul className="list-disc pl-6 space-y-1.5 text-zinc-300">
          <li><strong>Session &amp; Auth Tokens:</strong> Secure HTTP cookies and local storage keys to maintain your authenticated login session.</li>
          <li><strong>UI State:</strong> Local browser storage to remember your workspace interface preferences (such as collapsed sidebars or table filters).</li>
        </ul>
        <p>
          We do not use third-party advertising cookies, cross-site behavior trackers, or programmatic ad pixels.
        </p>
      </section>

      <section id="changes-and-contact" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">11. Policy Changes and Contact</h2>
        <p>
          We may update this Privacy Policy periodically to reflect improvements to our software or changes in legal standards. When changes occur, the updated policy will be published on this page with an updated &quot;Last Updated&quot; date.
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 text-sm mt-4">
          <p className="font-semibold text-white">Contact FlowDesk Privacy Support</p>
          <p>
            If you have questions, feedback, or concerns regarding your privacy or data handling, please reach out to:
          </p>
          <ul className="space-y-1 text-xs">
            <li><strong>Email:</strong> <a href={`mailto:${siteConfig.supportEmail}`} className="text-[#43D6B0] hover:underline font-mono">{siteConfig.supportEmail}</a></li>
            <li><strong>Support Form:</strong> <Link href="/contact?category=Privacy%20and%20Data%20Deletion" className="text-[#43D6B0] hover:underline">https://www.flow-desk.live/contact</Link></li>
            <li><strong>Turnaround Target:</strong> Within 1 to 2 business days</li>
          </ul>
        </div>
      </section>
    </LegalPageLayout>
  );
}
