'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { Button } from '@/frontend/shared/ui/button';
import {
  ShieldCheck,
  Calendar,
  ArrowLeft,
  Printer,
  AlertTriangle,
  ChevronRight,
  HelpCircle,
  ArrowRight,
  Clock,
  Mail,
} from 'lucide-react';
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

function formatSectionTitle(title: string) {
  const match = title.match(/^(\d+)\.\s*(.+)$/);
  if (match) {
    return {
      number: match[1].padStart(2, '0'),
      label: match[2],
    };
  }
  return {
    number: null,
    label: title,
  };
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
  const pathname = usePathname();
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (sections.length === 0) return;

    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '');
      if (sections.some((s) => s.id === hash)) {
        setActiveId(hash);
      } else {
        setActiveId(sections[0].id);
      }
    } else if (sections.length > 0) {
      setActiveId(sections[0].id);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) {
          setActiveId(visible.target.id);
        }
      },
      {
        rootMargin: '-80px 0px -65% 0px',
        threshold: 0,
      }
    );

    sections.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const navOffset = 88;
      const top = el.getBoundingClientRect().top + window.pageYOffset - navOffset;
      window.scrollTo({ top, behavior: 'smooth' });
      setActiveId(id);
      window.history.pushState(null, '', `#${id}`);
    }
  };

  const isContactPage = pathname === '/contact';

  return (
    <div className="min-h-screen bg-[#0D0E10] text-[#F5F5F0] font-sans antialiased selection:bg-[#43D6B0]/30 selection:text-white flex flex-col relative print:bg-white print:text-black print:min-h-0">
      {/* Subtle top ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(67,214,176,0.06),rgba(255,255,255,0))] print:hidden"
        aria-hidden="true"
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-[#0D0E10]/85 backdrop-blur-md border-b border-white/[0.08] print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity" aria-label="FlowDesk Home">
              <FlowDeskLogo variant="full" size="sm" />
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-zinc-400 border-l border-white/[0.08] pl-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#43D6B0]" />
              <span className="text-zinc-300">Trust &amp; Compliance Center</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs sm:text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/[0.04]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
            {!isContactPage && (
              <Link href="/contact">
                <Button variant="secondary" size="sm" className="text-xs">
                  Contact Support
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Document Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 print:p-0 print:m-0 print:max-w-none relative z-10">
        {draftForReview && (
          <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs sm:text-sm flex items-start gap-3 print:hidden">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-100">Draft Document for Legal Review</p>
              <p className="text-amber-300/80 mt-0.5 leading-relaxed">
                This document reflects verified technical controls and the DPDP Act 2023 commencement schedule. Final formal review by qualified legal counsel is recommended prior to commercial launch.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 print:block">
          {/* Left Column: Document Header & Content (65-75ch readability standard) */}
          <main className="lg:col-span-8 space-y-8 print:w-full print:max-w-none print:space-y-6 print-legal-document" id="legal-content">
            {/* Header Landmark */}
            <div className="border-b border-white/[0.08] pb-8 space-y-4 print:border-b-2 print:border-zinc-300 print:pb-4 print:space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#43D6B0]/10 border border-[#43D6B0]/20 text-xs font-mono text-[#43D6B0] font-medium print:bg-transparent print:border-zinc-400 print:text-zinc-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#43D6B0] print:text-zinc-700" />
                  <span>Version {version}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 font-mono print:text-zinc-700">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500 print:text-zinc-700" />
                  <span>Last Updated: {lastUpdated}</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (typeof window !== 'undefined') {
                      window.print();
                    }
                  }}
                  className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.08] hover:border-white/[0.16] text-xs font-medium text-zinc-200 hover:text-white transition-all cursor-pointer print:hidden shadow-sm active:scale-95"
                  suppressHydrationWarning
                  aria-label="Print Document"
                  title="Print this document or save as PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-[#43D6B0]" />
                  <span>Print / Save PDF</span>
                </button>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#F5F5F0] tracking-tight print:text-black print:text-3xl">
                {title}
              </h1>

              {intro && (
                <p className="text-base sm:text-lg text-[#9CA3AF] leading-relaxed max-w-prose print:text-zinc-800 print:text-base print:max-w-none">
                  {intro}
                </p>
              )}
            </div>

            {/* Document Body (max ~70ch for comfortable legal prose reading) */}
            <article className="prose prose-invert prose-zinc max-w-none space-y-10 text-zinc-300 leading-relaxed font-normal text-base print:prose-neutral print:text-black print:space-y-6">
              {children}
            </article>
          </main>

          {/* Right Column: Sticky Table of Contents (Desktop) */}
          {sections.length > 0 && (
            <aside className="hidden lg:block lg:col-span-4 print:hidden">
              <div className="sticky top-24 rounded-2xl bg-[#121514]/75 border border-white/[0.08] p-5 shadow-2xl shadow-black/40 backdrop-blur-md space-y-4 max-w-sm ml-auto">
                {/* TOC Header */}
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#43D6B0] shadow-[0_0_8px_rgba(67,214,176,0.8)]" />
                    <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#F5F5F0]">
                      Contents
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
                    {sections.length} {sections.length === 1 ? 'part' : 'parts'}
                  </span>
                </div>

                {/* Navigation links */}
                <nav aria-label="Table of contents" className="max-h-[calc(100vh-320px)] overflow-y-auto pr-1 -mr-1">
                  <ul className="space-y-1">
                    {sections.map((section) => {
                      const { number, label } = formatSectionTitle(section.title);
                      const isActive = activeId === section.id;

                      return (
                        <li key={section.id}>
                          <a
                            href={`#${section.id}`}
                            onClick={(e) => handleScrollTo(e, section.id)}
                            className={`group flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-200 cursor-pointer ${
                              isActive
                                ? 'bg-[#43D6B0]/10 text-white font-medium border border-[#43D6B0]/25 shadow-[0_0_12px_rgba(67,214,176,0.12)]'
                                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                            }`}
                          >
                            {number ? (
                              <span
                                className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md transition-colors shrink-0 ${
                                  isActive
                                    ? 'bg-[#43D6B0]/20 text-[#43D6B0] font-semibold'
                                    : 'bg-white/[0.04] text-zinc-500 group-hover:text-zinc-300'
                                }`}
                              >
                                {number}
                              </span>
                            ) : (
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                                  isActive ? 'bg-[#43D6B0]' : 'bg-zinc-600 group-hover:bg-zinc-400'
                                }`}
                              />
                            )}
                            <span className="truncate leading-snug">{label}</span>
                            <ChevronRight
                              className={`w-3.5 h-3.5 ml-auto shrink-0 transition-transform duration-150 ${
                                isActive
                                  ? 'text-[#43D6B0] opacity-100 translate-x-0.5'
                                  : 'opacity-0 -translate-x-1 group-hover:opacity-40 group-hover:translate-x-0'
                              }`}
                            />
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                {/* Bottom Helper / SLA Card */}
                <div className="pt-3 border-t border-white/[0.08]">
                  {isContactPage ? (
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                        <Clock className="w-3.5 h-3.5 text-[#43D6B0]" />
                        <span>Support Turnaround</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Ticket queue is monitored during Indian business hours. Billing and payment inquiries prioritized within 1 business day.
                      </p>
                      <a
                        href={`mailto:${siteConfig.supportEmail}`}
                        className="inline-flex items-center gap-1.5 text-[11px] text-[#43D6B0] hover:text-[#5ce0bc] font-mono transition-colors pt-0.5"
                      >
                        <Mail className="w-3 h-3 text-[#43D6B0]" />
                        <span className="truncate">{siteConfig.supportEmail}</span>
                      </a>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                        <HelpCircle className="w-3.5 h-3.5 text-[#43D6B0]" />
                        <span>Questions on this policy?</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Our support team is available to clarify any terms, data rights, or billing questions.
                      </p>
                      <Link
                        href="/contact"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#43D6B0] hover:text-[#5ce0bc] transition-colors group pt-0.5"
                      >
                        <span>Contact Support</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Public Footer */}
      <footer className="w-full bg-[#0D0E10] border-t border-white/[0.08] py-10 px-4 sm:px-6 lg:px-8 mt-auto print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-zinc-400">
          <div className="space-y-1 text-center md:text-left">
            <p className="text-zinc-300 font-semibold">{siteConfig.brandName} &bull; Freelancer Operating System</p>
            <p>&copy; 2026 {siteConfig.brandName}. All rights reserved.</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-zinc-400">
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
