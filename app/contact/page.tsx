'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LegalPageLayout } from '@/frontend/shared/layout/legal-page-layout';
import { Input } from '@/frontend/shared/ui/input';
import { Button } from '@/frontend/shared/ui/button';
import { Card } from '@/frontend/shared/ui/card';
import { siteConfig } from '@/shared/config/site-config';
import {
  Mail,
  User,
  HelpCircle,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

const CATEGORIES = [
  'Account and Login',
  'Subscription and Billing',
  'Payment Failure',
  'Refund Request',
  'Client Management',
  'Project Management',
  'File Upload',
  'Technical Issue',
  'Bug Report',
  'Privacy and Data Deletion',
  'Other',
] as const;

function ContactFormInner() {
  const searchParams = useSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('General support' as any);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [orderOrPaymentId, setOrderOrPaymentId] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(true);
  const [hpWebsite, setHpWebsite] = useState(''); // Honeypot field

  const [loading, setLoading] = useState(false);
  const [successReferenceId, setSuccessReferenceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize category from query param if available
  useEffect(() => {
    const queryCategory = searchParams.get('category');
    if (queryCategory && CATEGORIES.includes(queryCategory as any)) {
      setCategory(queryCategory as any);
    } else {
      setCategory('General support' as any in CATEGORIES ? ('General support' as any) : 'Account and Login');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    if (message.trim().length < 10) {
      setErrorMessage('Message must be at least 10 characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          category,
          subject: subject.trim(),
          message: message.trim(),
          orderOrPaymentId: orderOrPaymentId.trim() || null,
          privacyConsent,
          hp_website: hpWebsite,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to submit message.');
      }

      setSuccessReferenceId(data.referenceId || 'TKT-SUBMITTED');
    } catch (err: any) {
      setErrorMessage(
        err?.message || `Unable to submit your request. You can email us directly at ${siteConfig.supportEmail}.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setCategory('Account and Login');
    setSubject('');
    setMessage('');
    setOrderOrPaymentId('');
    setSuccessReferenceId(null);
    setErrorMessage(null);
  };

  if (successReferenceId) {
    return (
      <Card variant="crystal" className="p-8 sm:p-10 border-emerald-500/30 text-center space-y-6">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">Request Received</h2>
          <p className="text-sm text-zinc-300 max-w-md mx-auto">
            Your support request has been logged under Reference ID:
          </p>
          <div className="inline-block px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 font-mono text-base font-bold text-emerald-400">
            {successReferenceId}
          </div>
        </div>

        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          An acknowledgement email has been dispatched to <strong>{email}</strong>. Our team will investigate and reply directly within our target response window.
        </p>

        <div className="pt-4 flex justify-center gap-3">
          <Button variant="secondary" size="sm" onClick={handleReset} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Submit Another Request
          </Button>
          <Link href="/">
            <Button variant="primary" size="sm">
              Return to Home
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="crystal" className="p-6 sm:p-8 space-y-6 border-[#2A2A2A]">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white tracking-tight">Submit a Request</h2>
        <p className="text-xs text-zinc-400">
          Fill out the details below. Our support team will review and reply to your registered email.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-start gap-3"
        >
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-red-200">Submission Error</p>
            <p>{errorMessage}</p>
            <p className="pt-1 text-[11px] text-zinc-400">
              Need immediate help? Email us directly at{' '}
              <a href={`mailto:${siteConfig.supportEmail}`} className="text-white underline">
                {siteConfig.supportEmail}
              </a>
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Honeypot field (hidden from genuine users, filled by bots) */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="hp_website">Do not fill this field</label>
          <input
            id="hp_website"
            type="text"
            name="hp_website"
            tabIndex={-1}
            autoComplete="off"
            value={hpWebsite}
            onChange={(e) => setHpWebsite(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Your Name *"
            type="text"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            leftIcon={<User className="w-4 h-4 text-zinc-400" />}
            required
          />

          <Input
            label="Registered / Contact Email *"
            type="email"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4 text-zinc-400" />}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="category" className="block text-xs font-medium text-zinc-300">
            Issue Category *
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="w-full h-10 px-3 rounded-xl bg-[#111111] border border-[#2A2A2A] text-sm text-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors"
            required
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="bg-[#111111] text-white">
                {cat}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Subject *"
          type="text"
          placeholder="Brief summary of your issue or request"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          leftIcon={<HelpCircle className="w-4 h-4 text-zinc-400" />}
          required
        />

        <Input
          label="Order / Payment ID (Optional)"
          type="text"
          placeholder="e.g. pay_123456 or sub_123456 (if applicable)"
          value={orderOrPaymentId}
          onChange={(e) => setOrderOrPaymentId(e.target.value)}
          leftIcon={<FileText className="w-4 h-4 text-zinc-400" />}
        />

        <div className="space-y-1.5">
          <label htmlFor="message" className="block text-xs font-medium text-zinc-300">
            Message * <span className="text-zinc-500 font-normal">({message.length}/5000 chars)</span>
          </label>
          <textarea
            id="message"
            rows={5}
            placeholder="Please explain your question or issue in detail..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-3 rounded-xl bg-[#111111] border border-[#2A2A2A] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] transition-colors resize-y min-h-[120px]"
            required
            maxLength={5000}
          />
        </div>

        <div className="flex items-start gap-2.5 pt-1">
          <input
            id="privacyConsent"
            type="checkbox"
            checked={privacyConsent}
            onChange={(e) => setPrivacyConsent(e.target.checked)}
            className="mt-0.5 rounded border-white/20 bg-zinc-900 text-[#0047AB] focus:ring-0"
          />
          <label htmlFor="privacyConsent" className="text-xs text-zinc-400 leading-snug">
            I consent to FlowDesk processing my contact details strictly to investigate and respond to this support request in accordance with the{' '}
            <Link href="/privacy" className="text-zinc-300 underline hover:text-white">
              Privacy Policy
            </Link>
            .
          </label>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full text-sm font-semibold"
          isLoading={loading}
          disabled={loading || !privacyConsent}
          rightIcon={<Send className="w-4 h-4" />}
        >
          {loading ? 'Submitting Request...' : 'Send Message'}
        </Button>
      </form>
    </Card>
  );
}

export default function ContactPage() {
  return (
    <LegalPageLayout
      title="Contact & Support"
      intro="Have a question about FlowDesk, a payment inquiry, a technical issue, or a privacy request? Reach out to our support team."
      lastUpdated={siteConfig.policies.terms.lastUpdated}
      version="1.0.0"
      sections={[
        { id: 'contact-form', title: '1. Support Request Form' },
        { id: 'response-targets', title: '2. Response Target Guidelines' },
        { id: 'direct-contacts', title: '3. Direct Email Endpoints' },
        { id: 'grievance', title: '4. Grievance Redressal' },
      ]}
    >
      <section id="contact-form" className="space-y-4">
        <Suspense
          fallback={
            <div className="p-8 text-center text-zinc-500 font-mono text-xs">
              Loading support form...
            </div>
          }
        >
          <ContactFormInner />
        </Suspense>
      </section>

      <section id="response-targets" className="space-y-4 pt-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">2. Response Target Guidelines</h2>
        <p className="text-sm text-zinc-300">
          Our team handles requests according to the operational response targets below:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border border-white/10 rounded-xl overflow-hidden">
            <thead className="bg-white/[0.04] text-white font-mono text-xs uppercase">
              <tr>
                <th className="p-3.5 border-b border-white/10">Issue Type</th>
                <th className="p-3.5 border-b border-white/10">Response Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-zinc-300">
              <tr>
                <td className="p-3.5 font-medium text-white">General support</td>
                <td className="p-3.5 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Within 2 business days</span>
                </td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Payment issues</td>
                <td className="p-3.5 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Within 1 business day</span>
                </td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Login problems</td>
                <td className="p-3.5 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Within 1 business day</span>
                </td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Privacy requests</td>
                <td className="p-3.5 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Acknowledge within 2 business days</span>
                </td>
              </tr>
              <tr>
                <td className="p-3.5 font-medium text-white">Critical security issues</td>
                <td className="p-3.5 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Prioritised immediately</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          * Please note: The response times above represent internal operational targets and are not contractually guaranteed resolution windows. They do not replace or diminish statutory timelines prescribed under Indian consumer protection or privacy statutes.
        </p>
      </section>

      <section id="direct-contacts" className="space-y-4 pt-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">3. Direct Email Endpoints</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
            <h4 className="font-semibold text-white">General Support</h4>
            <a href={`mailto:${siteConfig.supportEmail}`} className="text-[#2563EB] underline break-all">
              {siteConfig.supportEmail}
            </a>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
            <h4 className="font-semibold text-white">Privacy &amp; Data Rights</h4>
            <a href={`mailto:${siteConfig.privacyEmail}`} className="text-[#2563EB] underline break-all">
              {siteConfig.privacyEmail}
            </a>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-1">
            <h4 className="font-semibold text-white">Security Vulnerabilities</h4>
            <a href={`mailto:${siteConfig.securityEmail}`} className="text-[#2563EB] underline break-all">
              {siteConfig.securityEmail}
            </a>
          </div>
        </div>
      </section>

      <section id="grievance" className="space-y-4 pt-6 border-t border-[#2A2A2A]">
        <h2 className="text-2xl font-bold text-white tracking-tight">4. Grievance Redressal</h2>
        <p className="text-sm text-zinc-300">
          Under the Digital Personal Data Protection Act, 2023, you can escalate formal privacy or data grievances directly to our appointed Grievance Officer:
        </p>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5 text-xs text-zinc-300">
          <p><strong>Officer:</strong> {siteConfig.grievanceOfficer.name}</p>
          <p><strong>Designation:</strong> {siteConfig.grievanceOfficer.title}</p>
          <p><strong>Email:</strong> <a href={`mailto:${siteConfig.grievanceOfficer.email}`} className="text-[#2563EB] underline">{siteConfig.grievanceOfficer.email}</a></p>
          <p><strong>Address:</strong> {siteConfig.grievanceOfficer.address}</p>
        </div>
      </section>
    </LegalPageLayout>
  );
}

