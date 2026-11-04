import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageLayout } from '@/frontend/shared/layout/legal-page-layout';
import { Button } from '@/frontend/shared/ui/button';
import { Users, FolderKanban, CheckSquare, Receipt, ShieldCheck, ArrowRight } from 'lucide-react';
import { siteConfig } from '@/shared/config/site-config';

export const metadata: Metadata = {
  title: 'About FlowDesk | Freelancer Operating System',
  description: 'FlowDesk is built for independent freelancers to bring client management, deliverable reviews, itemized invoicing, and payment tracking into one unified workspace.',
  alternates: {
    canonical: '/about',
  },
};

const sections = [
  { id: 'mission', title: '1. The Freelance Operating System' },
  { id: 'the-problem', title: '2. The Fragmentation of Freelance Work' },
  { id: 'how-it-works', title: '3. The Unified Workflow Loop' },
  { id: 'design-principles', title: '4. Built on Respect & Transparency' },
  { id: 'get-started', title: '5. Ready to Get Started' },
];

export default function AboutPage() {
  return (
    <LegalPageLayout
      title="About FlowDesk"
      intro="FlowDesk is purpose-built for independent freelancers, solo consultants, and boutique studio operators who need a single, cohesive workspace to manage clients, deliverables, and payments."
      lastUpdated={siteConfig.policies.terms.lastUpdated}
      version="1.0.0"
      sections={sections}
    >
      <section id="mission" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">1. The Freelance Operating System</h2>
        <p>
          Independent creators, designers, software engineers, and consultants are running real businesses. Yet most tools designed for them either treat them like small enterprise companies with overwhelming bureaucracy, or reduce their work to a glorified to-do list.
        </p>
        <p>
          FlowDesk was created to be the definitive <strong>Freelancer Operating System</strong>—a single workspace connecting client onboarding, project execution, deliverable reviews, approvals, itemized invoices, and payment tracking.
        </p>
      </section>

      <section id="the-problem" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">2. The Fragmentation of Freelance Work</h2>
        <p>
          Freelancers routinely suffer from operational fragmentation:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Client feedback scattered across email chains, WhatsApp messages, and Slack threads.</li>
          <li>Deliverable files uploaded to messy shared cloud folders with ambiguous version labels like <code>final_v2_reallyfinal.pdf</code>.</li>
          <li>Invoices built manually in spreadsheets, with manual bank transfer tracking and awkward payment chasing.</li>
          <li>Uncertainty about which milestones were formally approved by the client.</li>
        </ul>
        <p>
          FlowDesk solves this by organizing all client interactions around a structured, transparent client review portal.
        </p>
      </section>

      <section id="how-it-works" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">3. The Unified Workflow Loop</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Dedicated Client Hubs</span>
            </div>
            <p className="text-xs text-zinc-300">
              Each client receives an isolated workspace with active projects, milestone timelines, contract documents, and payment history in one place.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <CheckSquare className="w-4 h-4 text-[#2563EB]" />
              <span>Deliverables &amp; Approvals</span>
            </div>
            <p className="text-xs text-zinc-300">
              Share deliverable versions with status tracking. Clients review work and submit structured change requests or approvals directly tied to the file.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Receipt className="w-4 h-4 text-amber-400" />
              <span>Itemized Invoicing</span>
            </div>
            <p className="text-xs text-zinc-300">
              Generate professional GST/tax compliant invoices with line items, partial payments, payment instructions, UPI QR codes, and downloadable PDF/image exports.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>Client Review Portal</span>
            </div>
            <p className="text-xs text-zinc-300">
              A clean, dedicated client-facing portal where your clients inspect work, download assets, and pay invoices without seeing internal project notes.
            </p>
          </div>
        </div>
      </section>

      <section id="design-principles" className="space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">4. Built on Respect &amp; Transparency</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>You Own Your Work:</strong> You maintain 100% intellectual property ownership of your files, briefs, and client deliverables. FlowDesk claims zero rights over your creations.</li>
          <li><strong>No Hostile Locking:</strong> If you cancel your subscription, your data is never held hostage or deleted. You fall back to the Free Starter tier and retain full read and export access.</li>
          <li><strong>Privacy First:</strong> Zero marketing ad trackers, zero data reselling, and zero tracking cookies. We make money from subscription plans, not from exploiting your business data.</li>
        </ul>
      </section>

      <section id="get-started" className="pt-4 border-t border-[#2A2A2A] space-y-4">
        <h2 className="text-2xl font-bold text-white tracking-tight">5. Ready to Get Started?</h2>
        <p>
          Start with our Free Starter tier (₹0 forever) with up to 2 active clients and 3 projects, or choose a plan that suits your client volume.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link href="/signup">
            <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Create Your Free Workspace
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="secondary" size="md">
              View Plans &amp; Pricing
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="ghost" size="md">
              Contact Us
            </Button>
          </Link>
        </div>
      </section>
    </LegalPageLayout>
  );
}

