'use client';

import React from 'react';
import Link from 'next/link';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { Button } from '@/frontend/shared/ui/button';
import { ShieldCheck, Calendar, ArrowLeft, Printer, AlertTriangle } from 'lucide-react';
import { siteConfig } from '@/shared/config/site-config';

export interface TocSection {
  id: string;
  title: string;
}

export interface LegalPageLayoutProps {
  title: string;
  intro?: string;
  lastUpdated: string;
  version: string;
  sections?: TocSection[];
  draftForReview?: boolean;
  children: React.ReactNode;
}

export const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({
  title,
  intro,
  lastUpdated,
  version,
  sections = [],
  draftForReview = false,
  children,
}) => {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F7FA] font-sans antialiased selection:bg-[#0047AB] selection:text-white flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-[#0A0A0A]/90 backdrop-blur-md border-b border-[#2A2A2A] print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity" aria-label="FlowDesk Home">
              <FlowDeskLogo variant="full" size="sm" />
            </Link>
            <div className="hidden md:flex items-center gap-1 text-xs font-mono text-zinc-400 border-l border-[#2A2A2A] pl-4">
              <span className="text-zinc-500">Legal &amp; Trust Center</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Home</span>
            </Link>
            <Link href="/contact">
              <Button variant="secondary" size="sm" className="text-xs">
                Contact Support
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Document Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {draftForReview && (
          <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs sm:text-sm flex items-start gap-3 print:hidden">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-100">Draft Document for Legal Review</p>
              <p className="text-amber-300/80 mt-0.5">
                This document is prepared to reflect verified technical controls and the DPDP Act 2023 commencement schedule. Final formal review by qualified legal counsel is recommended prior to commercial launch.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column: Document Header & Content (65-75ch readability standard) */}
          <main className="lg:col-span-8 space-y-8" id="legal-content">
            {/* Header Landmark */}
            <div className="border-b border-[#2A2A2A] pb-8 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0047AB]/20 border border-[#2563EB]/30 text-xs font-mono text-[#E8F0FF]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Version {version}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Last Updated: {lastUpdated}</span>
                </span>
                <button
                  type="button"
                  onClick={() => typeof window !== 'undefined' && window.print()}
                  className="ml-auto inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors print:hidden"
                  aria-label="Print Document"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print</span>
                </button>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
                {title}
              </h1>

              {intro && (
                <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-prose">
                  {intro}
                </p>
              )}
            </div>

            {/* Document Body (max ~70ch for comfortable legal prose reading) */}
            <article className="prose prose-invert prose-zinc max-w-none space-y-10 text-zinc-300 leading-relaxed font-normal text-base print:text-black">
              {children}
            </article>
          </main>

          {/* Right Column: Sticky Table of Contents (Desktop) */}
          {sections.length > 0 && (
            <aside className="hidden lg:block lg:col-span-4 print:hidden">
              <div className="sticky top-24 p-6 rounded-2xl bg-[#111111]/80 border border-[#2A2A2A] backdrop-blur-md space-y-4">
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Table of Contents
                </h2>
                <nav aria-label="Table of contents">
                  <ul className="space-y-2 text-sm">
                    {sections.map((section) => (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          className="block text-zinc-400 hover:text-white transition-colors leading-snug py-0.5 hover:translate-x-0.5 transform duration-150"
                        >
                          {section.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>

                <div className="pt-4 border-t border-[#2A2A2A] text-xs text-zinc-400 space-y-2">
                  <p className="font-semibold text-zinc-300">Need clarification?</p>
                  <p>Our support team is available for any questions regarding these terms.</p>
                  <Link
                    href="/contact"
                    className="inline-block text-[#2563EB] hover:text-[#3B82F6] font-semibold transition-colors"
                  >
                    Contact Support &rarr;
                  </Link>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Public Footer */}
      <footer className="w-full bg-[#0A0A0A] border-t border-[#2A2A2A] py-12 px-4 sm:px-6 lg:px-8 mt-auto print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-zinc-400">
          <div className="space-y-1 text-center md:text-left">
            <p className="text-zinc-300 font-semibold">{siteConfig.brandName} &bull; Freelancer Operating System</p>
            <p>&copy; 2026 {siteConfig.brandName}. All rights reserved.</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono">
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link>
            <Link href="/cancellation-policy" className="hover:text-white transition-colors">Cancellation Policy</Link>
            <Link href="/security" className="hover:text-white transition-colors">Security</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

