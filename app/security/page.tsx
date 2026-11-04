import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageLayout } from '@/frontend/shared/layout/legal-page-layout';
import { siteConfig } from '@/shared/config/site-config';
import { Shield, Lock, Key, Server, Database, EyeOff } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Security & Data Handling',
  description: 'Verified technical security controls, multi-tenant isolation, transport encryption, and responsible disclosure guidelines at FlowDesk.',
  alternates: {
    canonical: '/security',
  },
};

const sections = [
  { id: 'overview', title: '1. Security Philosophy & Standards' },
  { id: 'multi-tenancy', title: '2. Multi-Tenant Isolation & Row Level Security' },
  { id: 'encryption', title: '3. Transport Security & Cryptography' },
  { id: 'authentication', title: '4. Authentication & Session Security' },
  { id: 'file-storage', title: '5. File Storage & MIME Validation' },
  { id: 'payment-security', title: '6. Payment Gateway & PCI-DSS Handling' },
  { id: 'abuse-prevention', title: '7. Rate Limiting & Abuse Prevention' },
  { id: 'logging-masking', title: '8. Audit Logging & Sensitive Data Redaction' },
  { id: 'responsible-disclosure', title: '9. Responsible Disclosure Program' },
  { id: 'contact', title: '10. Security Contact' },
];

export default function SecurityPage() {
  const { security } = siteConfig.policies;

  return (
    <LegalPageLayout
      title="Security & Data Handling"
      intro="FlowDesk protects independent freelancers and their clients with defense-in-depth security engineering. This page documents our verified technical controls, multi-tenant isolation models, and vulnerability disclosure policies."
      lastUpdated={security.lastUpdated}
      version={security.version}
      sections={sections}
    >
      <section id="overview" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">1. Security Philosophy &amp; Transparent Engineering</h2>
        <p>
          At FlowDesk, we believe security claims should be substantiated by actual code and operational architecture rather than generic marketing badges.
        </p>
        <p>
          We design our systems to ensure client deliverables, revision feedback, itemized invoices, and freelancer payout details remain strictly isolated and protected against unauthorized access.
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-zinc-300">
          <strong>Compliance Disclosure:</strong> FlowDesk is operated from India. We do not make claims of unverified third-party certifications (such as ISO 27001 or SOC 2 Type II) that have not been formally audited by an accredited registrar. Our security assurances rest on the real, verifiable technical and operational safeguards documented below.
        </div>
      </section>

      <section id="multi-tenancy" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">2. Multi-Tenant Isolation &amp; Row Level Security (RLS)</h2>
        <p>
          FlowDesk utilizes a hosted PostgreSQL database managed by Supabase, structured around a hardened multi-tenant boundary:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Database className="w-4 h-4 text-[#2563EB]" />
              <span>Row Level Security (RLS)</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Every database table containing workspace records enforces PostgreSQL Row Level Security. Queries executed on behalf of a user can only access rows matching their authenticated <code>workspace_id</code> or bound client ID.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <EyeOff className="w-4 h-4 text-[#2563EB]" />
              <span>Internal Notes Redaction</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Private freelancer notes, internal cost margins, and confidential drafts are strictly redacted at the backend service layer before deliverable data is transmitted to client review portals.
            </p>
          </div>
        </div>
      </section>

      <section id="encryption" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">3. Transport Security &amp; Cryptography</h2>
        <p>
          All communications between your browser, client portals, and FlowDesk servers are encrypted in transit:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Transport Layer Security (TLS):</strong> Modern TLS 1.3 and TLS 1.2 protocols with high-strength cipher suites.</li>
          <li><strong>HTTP Strict Transport Security (HSTS):</strong> Enforced on all responses with <code>max-age=63072000; includeSubDomains</code> (2 years) to prevent protocol downgrade attacks.</li>
          <li><strong>Anti-Clickjacking &amp; CSP:</strong> Protected by <code>X-Frame-Options: DENY</code> and <code>frame-ancestors &apos;none&apos;</code> headers. Content Security Policy headers restrict unauthorized external script execution.</li>
          <li><strong>Webhook HMAC Signatures:</strong> Inbound webhooks from Razorpay and Brevo are verified using timing-safe cryptographic comparisons (<code>crypto.timingSafeEqual</code>) of HMAC-SHA256 signatures, preventing spoofing or replay attacks.</li>
        </ul>
      </section>

      <section id="authentication" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">4. Authentication &amp; Session Security</h2>
        <p>
          Authentication is powered by Supabase Auth with server-verified sessions:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Password Hashing:</strong> Passwords are never stored in plain text. Credentials are hashed using industry-standard salted hashing algorithms (bcrypt/Argon2) within Supabase&apos;s identity infrastructure.</li>
          <li><strong>Session Cookies:</strong> Sessions use HTTP-only, Secure, SameSite cookies. JavaScript running in the browser cannot read raw authentication secrets.</li>
          <li><strong>Server-Authoritative Identity:</strong> API route handlers independently verify the authenticated user via <code>requireApiCaller()</code> on every write request. User IDs or workspace IDs provided in client payloads are ignored in favor of the cryptographic session token.</li>
        </ul>
      </section>

      <section id="file-storage" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">5. File Storage &amp; MIME Magic-Byte Validation</h2>
        <p>
          Deliverables, briefs, brand logos, and invoices are stored in isolated cloud object storage:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Scoped Storage Hierarchy:</strong> Files are stored strictly within workspace-prefixed paths: <code>workspaces/&#123;workspaceId&#125;/...</code>. A freelancer cannot access storage paths belonging to another workspace.</li>
          <li><strong>Magic-Byte Inspection:</strong> Server-side upload handlers inspect binary magic bytes of uploaded files rather than relying on user-provided file extensions, blocking disguised executable binaries.</li>
          <li><strong>Safe Delivery:</strong> Deliverables served to clients are delivered with appropriate <code>Content-Disposition</code> headers to prevent cross-site script execution.</li>
        </ul>
      </section>

      <section id="payment-security" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">6. Payment Gateway &amp; PCI-DSS Handling</h2>
        <p>
          Payment security is built around complete isolation from sensitive payment card data:
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
          <p className="font-semibold text-white">Zero Cardholder Data on FlowDesk Servers</p>
          <p className="text-sm">
            FlowDesk servers never receive, process, or store raw 16-digit credit card numbers, debit card numbers, or CVVs. All card interactions are executed inside Razorpay&apos;s PCI-DSS Level 1 compliant secure iframe checkout.
          </p>
        </div>
        <p>
          FlowDesk receives only non-sensitive tokens, order references, and payment verification IDs required to reconcile invoices.
        </p>
      </section>

      <section id="abuse-prevention" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">7. Rate Limiting &amp; Abuse Prevention</h2>
        <p>
          To safeguard against brute-force credential stuffing, API harvesting, and denial-of-service abuse, FlowDesk implements layered rate limiting:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>IP-Based Rate Limiting:</strong> Endpoints including login, checkout, account deletion, and contact submissions enforce sliding-window request quotas.</li>
          <li><strong>Payload Size Guardrails:</strong> Inbound JSON payloads are hard-limited to 100 KB max to prevent server memory exhaustion.</li>
          <li><strong>Honeypot Protection:</strong> Public contact and submission forms incorporate hidden honeypot validation fields to trap automated robotic spam.</li>
        </ul>
      </section>

      <section id="logging-masking" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">8. Audit Logging &amp; Sensitive Data Redaction</h2>
        <p>
          System audit logs track operational events while prioritizing user privacy:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Automated Data Masking:</strong> Application loggers automatically filter out passwords, authorization tokens, session keys, and financial credentials before records are written.</li>
          <li><strong>Security Event Auditing:</strong> Authentication state changes, permission rejections, and subscription transitions generate immutable security log entries for forensic traceability.</li>
        </ul>
      </section>

      <section id="responsible-disclosure" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">9. Responsible Disclosure Program</h2>
        <p>
          We welcome and appreciate responsible security vulnerability reports from researchers and ethical hackers.
        </p>
        <p>
          If you discover a potential vulnerability in FlowDesk, we ask that you:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Email your findings to <a href={`mailto:${siteConfig.securityEmail}`} className="text-[#2563EB] underline font-semibold">{siteConfig.securityEmail}</a>.</li>
          <li>Include detailed steps to reproduce the issue (proof-of-concept scripts or request summaries).</li>
          <li>Provide us with reasonable time to remediate the vulnerability before public disclosure.</li>
          <li>Refrain from accessing, modifying, or destroying data belonging to other users.</li>
          <li>Refrain from executing distributed denial-of-service (DDoS) attacks or social engineering.</li>
        </ul>
        <p>
          We commit to acknowledging received reports within <strong>one (1) business day</strong> and providing updates as investigations progress.
        </p>
      </section>

      <section id="contact" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">10. Security Contact</h2>
        <p>
          For urgent security notifications, incident alerts, or vulnerability disclosures:
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1 text-sm">
          <p><strong>Security Email:</strong> <a href={`mailto:${siteConfig.securityEmail}`} className="text-[#2563EB] underline">{siteConfig.securityEmail}</a></p>
          <p><strong>Response Target:</strong> Critical security reports are prioritized immediately</p>
          <p><strong>Contact Form:</strong> <Link href="/contact?category=Technical%20Issue" className="text-[#2563EB] underline">flowdesk.app/contact</Link></p>
        </div>
      </section>
    </LegalPageLayout>
  );
}

