/**
 * FlowDesk Privacy Policy
 *
 * REGULATORY & STATUTORY SOURCES CONSULTED:
 * 1. The Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023, Republic of India).
 * 2. MeitY Gazette Notification G.S.R. 843(E) (Nov 13–14, 2025) - Phased Commencement of Sections 1(2), 2, 18-26, 35, 38-43.
 * 3. MeitY Gazette Notification G.S.R. 844(E) (Nov 13, 2025) - Establishment of the Data Protection Board of India (DPBI).
 * 4. Digital Personal Data Protection Rules, 2025 (Notified Nov 2025; 18-month compliance runway to May 2027).
 * 5. MeitY Digital Personal Data Protection (Removal of Difficulties) Order, 2026 (Gazette Notification Oct 7, 2026).
 *
 * SCOPE & STATUS:
 * Forward-compatible implementation for freelance SaaS operations in India.
 * Note: Marked as "Draft for legal review" in compliance audit records.
 */

import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageLayout } from '@/frontend/shared/layout/legal-page-layout';
import { siteConfig } from '@/shared/config/site-config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How FlowDesk collects, processes, stores, and protects personal data in compliance with the Digital Personal Data Protection Act, 2023.',
  alternates: {
    canonical: '/privacy',
  },
};

const sections = [
  { id: 'introduction', title: '1. Introduction & Data Fiduciary Identity' },
  { id: 'regulatory-status', title: '2. DPDP Act 2023 Compliance & Commencement' },
  { id: 'data-collected', title: '3. Personal Data Actually Collected' },
  { id: 'purposes', title: '4. Purposes & Grounds for Processing' },
  { id: 'processors', title: '5. Data Processors & Third-Party Sharing' },
  { id: 'security-measures', title: '6. Technical & Operational Security Measures' },
  { id: 'retention', title: '7. Data Retention & Account Deletion' },
  { id: 'data-principal-rights', title: '8. Your Rights as a Data Principal' },
  { id: 'children-data', title: '9. Children’s Personal Data' },
  { id: 'cookies-analytics', title: '10. Cookies, Storage & Tracking' },
  { id: 'international-transfers', title: '11. Cross-Border Data Transfers' },
  { id: 'grievance-redressal', title: '12. Grievance Officer & Contact Information' },
];

export default function PrivacyPage() {
  const { privacy } = siteConfig.policies;

  return (
    <LegalPageLayout
      title="Privacy Policy"
      intro="This Privacy Policy explains how FlowDesk collects, handles, stores, and safeguards personal data of freelancers and their client portal visitors under applicable Indian privacy legislation."
      lastUpdated={privacy.lastUpdated}
      version={privacy.version}
      draftForReview={privacy.draftForLegalReview}
      sections={sections}
    >
      <section id="introduction" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">1. Introduction &amp; Data Fiduciary Identity</h2>
        <p>
          {siteConfig.legalEntityName} (&quot;FlowDesk&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) respects the privacy and autonomy of every individual whose personal data is processed within our systems.
        </p>
        <p>
          Under the <em>Digital Personal Data Protection Act, 2023</em> (&quot;DPDP Act&quot;), FlowDesk acts as a <strong>Data Fiduciary</strong> with respect to the account information and business profile data of registered freelancers.
        </p>
        <p>
          With respect to client data, contact lists, invoices, and deliverable files uploaded into workspace portals by freelancers, the freelancer acts as the primary Data Fiduciary determining the purpose of processing, and FlowDesk acts as a <strong>Data Processor</strong> providing cloud workspace infrastructure strictly pursuant to user instructions.
        </p>
      </section>

      <section id="regulatory-status" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">2. DPDP Act 2023 Compliance &amp; Phased Commencement Schedule</h2>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
          <p className="font-semibold text-white">Statutory Status as of November 2026</p>
          <p className="text-sm">
            Following official notifications by the Ministry of Electronics and Information Technology (MeitY), the DPDP Act 2023 is being commenced in a phased framework:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 text-xs text-zinc-300">
            <li><strong>In Force (Phase 1, since Nov 2025):</strong> Statutory definitions (Section 2), establishment and jurisdiction of the Data Protection Board of India (DPBI, Sections 18–26), government exemptions, penalties, and rule-making authority.</li>
            <li><strong>In Transition (Phase 2, Nov 2026):</strong> Framework for registered Consent Managers under Section 6(9).</li>
            <li><strong>Upcoming Full Compliance (Phase 3, May 13, 2027):</strong> Full mandatory enforcement of detailed consent notices (Rule 3), strict Data Principal rights, and parental verification systems.</li>
          </ul>
        </div>
        <p>
          FlowDesk is committed to forward-compatible privacy by design. We implement fair processing, strict purpose limitation, data minimization, and active grievance redressal channels effective immediately.
        </p>
      </section>

      <section id="data-collected" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">3. Personal Data Actually Collected</h2>
        <p>
          We collect only personal data that is strictly necessary to operate our freelance management platform. We do not engage in unauthorized web scraping, behavioral advertising tracking, or data brokering.
        </p>
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <h3 className="text-lg font-semibold text-white">A. Freelancer Account Information</h3>
            <ul className="list-disc pl-6 space-y-1 text-sm text-zinc-300">
              <li><strong>Identity Details:</strong> Full name, email address, studio or company name, avatar image URL.</li>
              <li><strong>Security Credentials:</strong> Encrypted password hashes (processed via Supabase Auth using bcrypt/Argon2; plain-text passwords are never accessible to FlowDesk).</li>
              <li><strong>Business &amp; Payout Settings:</strong> Business address, tax identification numbers (GSTIN/PAN if provided), bank account details (account holder name, bank name, account number, IFSC code, branch name), UPI ID, and uploaded UPI QR code images for client invoice settlements.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <h3 className="text-lg font-semibold text-white">B. Client Portal &amp; Project Data</h3>
            <ul className="list-disc pl-6 space-y-1 text-sm text-zinc-300">
              <li><strong>Client Records:</strong> Client contact name, client company name, client email address, preferred currency.</li>
              <li><strong>Work Deliverables &amp; Feedback:</strong> Deliverable files (PDF, images, archives), version tags, review comments, milestone statuses, and revision requests submitted in the portal.</li>
              <li><strong>Invoicing Records:</strong> Itemized invoice descriptions, unit rates, tax amounts, applied discounts, issue dates, due dates, payment reference numbers, and transaction status.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <h3 className="text-lg font-semibold text-white">C. Technical &amp; Operational Metadata</h3>
            <ul className="list-disc pl-6 space-y-1 text-sm text-zinc-300">
              <li><strong>Network Diagnostics:</strong> IP addresses (used exclusively for security rate-limiting, geo-session defense, and fraud prevention), browser user-agent strings, and request timestamps.</li>
              <li><strong>Session Cookies:</strong> Strictly necessary HTTP-only authentication session tokens required to maintain logged-in state.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="purposes" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">4. Purposes &amp; Grounds for Processing</h2>
        <p>
          We process personal data under legitimate statutory grounds defined in Section 4 and Section 7 of the DPDP Act 2023, specifically:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Performance of Contract:</strong> Creating your workspace, generating itemized invoices, hosting deliverable version files, facilitating client reviews, and managing subscription entitlements.</li>
          <li><strong>Payment Processing:</strong> Reconciling SaaS subscription charges via Razorpay and logging payment receipts.</li>
          <li><strong>Transactional Notifications:</strong> Sending automated email notices via Brevo for client deliverable ready alerts, invoice deliveries, payment receipts, and security alerts.</li>
          <li><strong>Security &amp; Abuse Prevention:</strong> Enforcing API rate limits, blocking brute-force attacks, verifying webhook authenticity (HMAC-SHA256), and safeguarding isolated workspaces against unauthorized cross-tenant access.</li>
          <li><strong>Statutory Compliance:</strong> Retaining mandatory tax invoices, GST transaction records, and financial receipts as required under Indian taxation and corporate laws.</li>
        </ul>
      </section>

      <section id="processors" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">5. Data Processors &amp; Third-Party Sharing</h2>
        <p>
          We do not sell, rent, or monetize your personal data. We disclose data solely to verified Data Processors bound by contractual confidentiality and security commitments:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border border-white/10 rounded-xl overflow-hidden">
            <thead className="bg-white/[0.04] text-white font-mono text-xs uppercase">
              <tr>
                <th className="p-3 border-b border-white/10">Processor</th>
                <th className="p-3 border-b border-white/10">Purpose</th>
                <th className="p-3 border-b border-white/10">Data Shared</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-zinc-300">
              <tr>
                <td className="p-3 font-semibold text-white">Supabase Inc.</td>
                <td className="p-3">Managed cloud database, object storage &amp; auth engine</td>
                <td className="p-3">Profiles, workspace entities, deliverables, documents, invoices</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white">Razorpay Software Pvt. Ltd.</td>
                <td className="p-3">SaaS recurring billing &amp; client invoice checkout</td>
                <td className="p-3">Order IDs, subscription IDs, billing amounts, customer email/phone</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white">Brevo (Sendinblue)</td>
                <td className="p-3">Transactional email delivery &amp; notification dispatch</td>
                <td className="p-3">Recipient email, recipient name, transactional email copy</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="security-measures" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">6. Technical &amp; Operational Security Measures</h2>
        <p>
          We implement rigorous defense-in-depth technical controls to protect personal data from unauthorized access, alteration, disclosure, or loss:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Transport Security:</strong> All data in transit is encrypted using modern TLS (TLS 1.2 and TLS 1.3). HTTP Strict Transport Security (HSTS) is enforced with a 2-year duration (<code>max-age=63072000; includeSubDomains</code>).</li>
          <li><strong>Database Multi-Tenancy &amp; RLS:</strong> Workspaces are logically isolated using PostgreSQL Row Level Security (RLS). A user or client cannot read or modify another workspace&apos;s records.</li>
          <li><strong>Storage Isolation:</strong> Uploaded files are segmented into strictly validated storage paths (<code>workspaces/&#123;workspaceId&#125;/...</code>) and verified using server-side magic byte inspection to prevent executable payload uploads.</li>
          <li><strong>Cryptographic Webhook Signatures:</strong> Inbound payment and email webhooks are validated using timing-safe HMAC-SHA256 verification before any state change is executed.</li>
          <li><strong>Sensitive Data Masking:</strong> Central application loggers automatically redact authentication tokens, credit card metadata, and passwords before logging.</li>
          <li><strong>Zero Cardholder Data Storage:</strong> FlowDesk servers never handle, store, or transmit raw credit/debit card numbers or CVVs. All payment interactions occur inside Razorpay&apos;s certified PCI-DSS Level 1 environment.</li>
          <li><strong>Clarification on Encryption:</strong> While data is encrypted in transit and stored in protected databases with encryption at rest provided by cloud providers, FlowDesk does NOT offer End-to-End Encryption (E2EE) where the provider cannot decrypt data, as server-side invoice generation and deliverable rendering require server processing.</li>
        </ul>
      </section>

      <section id="retention" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">7. Data Retention &amp; Account Deletion</h2>
        <p>
          We retain personal data only for as long as your workspace account remains active and as required for the fulfillment of the purposes outlined herein:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Active Accounts:</strong> Retained while your workspace subscription or free account is operational.</li>
          <li><strong>Freelancer Self-Deletion:</strong> When a freelancer initiates account deletion in Settings, the account enters a five (5) day recovery grace period during which it can be restored. Following this window, workspace databases and storage files are permanently purged.</li>
          <li><strong>Client Account Deletion:</strong> Client accounts scheduled for deletion enter a thirty (30) day recovery window before permanent removal.</li>
          <li><strong>Statutory Invoicing Records:</strong> Financial records, invoice numbers, tax breakdowns, and payment audit logs are retained for statutory retention periods prescribed under Indian tax statutes (minimum 8 years under the <em>Income Tax Act, 1961</em> and <em>CGST Act, 2017</em>).</li>
        </ul>
      </section>

      <section id="data-principal-rights" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">8. Your Rights as a Data Principal (DPDP Act, 2023)</h2>
        <p>
          Under the DPDP Act 2023, you have enforceable rights regarding your digital personal data:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
            <h4 className="font-semibold text-white">Right to Access</h4>
            <p className="text-xs text-zinc-300">You may request a summary of the personal data being processed about you and the identities of third-party processors.</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
            <h4 className="font-semibold text-white">Right to Correction &amp; Updating</h4>
            <p className="text-xs text-zinc-300">You may update inaccurate or incomplete personal data directly within your Account Settings at any time.</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
            <h4 className="font-semibold text-white">Right to Erasure</h4>
            <p className="text-xs text-zinc-300">You may request the deletion of your personal data, subject to statutory tax and financial retention laws.</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
            <h4 className="font-semibold text-white">Right to Grievance Redressal</h4>
            <p className="text-xs text-zinc-300">You have the right to register grievances with our dedicated Grievance Officer and escalate to the DPBI if unresolved.</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
            <h4 className="font-semibold text-white">Right to Nominate</h4>
            <p className="text-xs text-zinc-300">In the event of death or incapacity, you have the right to designate an authorized nominee to exercise your data rights.</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
            <h4 className="font-semibold text-white">Right to Withdraw Consent</h4>
            <p className="text-xs text-zinc-300">Where processing is based on consent, you may withdraw it at any time by closing your account or contacting support.</p>
          </div>
        </div>
        <p className="text-sm">
          To submit a privacy request, please use our <Link href="/contact?category=Privacy%20and%20Data%20Deletion" className="text-[#2563EB] underline">Contact &amp; Privacy Request Form</Link>. We acknowledge requests within two (2) business days.
        </p>
      </section>

      <section id="children-data" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">9. Children’s Personal Data</h2>
        <p>
          FlowDesk is an enterprise business operating system designed exclusively for adults and legally emancipated business professionals (18 years of age or older). We do not knowingly solicit or collect personal data from children under eighteen years of age.
        </p>
        <p>
          If we discover that personal data of a minor has been mistakenly submitted without verified parental or legal guardian consent, we will promptly delete such records.
        </p>
      </section>

      <section id="cookies-analytics" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">10. Cookies, Local Storage &amp; Tracking</h2>
        <p>
          <strong>No Marketing or Behavioral Tracking:</strong> FlowDesk does NOT load third-party advertising cookies, analytics beacons, Facebook Pixels, or Google Tag Manager trackers.
        </p>
        <p>
          <strong>Essential Authentication Cookies Only:</strong> We use strictly necessary session cookies provided by Supabase Auth (<code>sb-access-token</code>, <code>sb-refresh-token</code>) to verify your authenticated identity across page requests. Because these cookies are strictly essential for providing the service requested by the user, a cookie consent banner is not legally mandated under Indian privacy principles.
        </p>
      </section>

      <section id="international-transfers" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">11. Cross-Border Data Transfers</h2>
        <p>
          Your personal data may be processed on servers hosted by our cloud infrastructure providers (including Supabase data centers). Such transfers are conducted in full compliance with Section 16 of the DPDP Act 2023 and any official negative list of restricted countries notified by the Central Government of India.
        </p>
      </section>

      <section id="grievance-redressal" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">12. Grievance Redressal Officer &amp; Contact Information</h2>
        <p>
          In accordance with the DPDP Act 2023 and the <em>Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021</em>, FlowDesk has appointed a dedicated Grievance Officer:
        </p>
        <div className="p-5 rounded-2xl bg-[#111111]/90 border border-[#2A2A2A] space-y-2 text-sm">
          <p><strong>Officer Name:</strong> {siteConfig.grievanceOfficer.name}</p>
          <p><strong>Designation:</strong> {siteConfig.grievanceOfficer.title}</p>
          <p><strong>Email Address:</strong> <a href={`mailto:${siteConfig.grievanceOfficer.email}`} className="text-[#2563EB] underline">{siteConfig.grievanceOfficer.email}</a></p>
          <p><strong>Postal Address:</strong> {siteConfig.grievanceOfficer.address}</p>
          <p><strong>Statutory Response Window:</strong> We acknowledge grievances within forty-eight (48) hours and resolve eligible complaints within statutory timelines.</p>
          <p className="text-xs text-zinc-400 pt-2 border-t border-white/10">
            If you are not satisfied with our grievance resolution, you may escalate your complaint to the <strong>Data Protection Board of India (DPBI)</strong> in accordance with Section 21 of the DPDP Act 2023.
          </p>
        </div>
      </section>
    </LegalPageLayout>
  );
}

