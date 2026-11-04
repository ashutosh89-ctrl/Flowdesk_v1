'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How is FlowDesk different from a generic project management tool?',
      a: 'FlowDesk is purpose-built for the freelance-client relationship. Instead of just task lists, it unifies client onboarding, project scoping, deliverable version control, structured client approval sign-offs, document vaults, itemized invoicing, and payment tracking in one connected workspace.',
    },
    {
      q: 'How do my clients join and access their portal?',
      a: 'You send them a secure invitation link. New clients complete a quick 10-second setup to create their verified client account, while returning clients sign in directly to connect to your workspace. From there, they have private, authenticated access to review deliverables, request revisions, approve milestones, and view invoices.',
    },
    {
      q: 'Can I generate professional, itemized invoices?',
      a: 'Yes. FlowDesk allows you to create itemized invoices with configurable tax rates (including GST), discounts, multi-currency support (USD, INR, EUR, GBP), flexible payment terms, and instant print/PDF export.',
    },
    {
      q: 'How does payment tracking and reconciliation work?',
      a: 'FlowDesk keeps your financial pipeline organized. You can record payments received, track pending balances and overdue amounts, view aging breakdowns, and maintain a clear audit trail of completed settlements.',
    },
    {
      q: 'How do clients submit revision requests and feedback?',
      a: 'Clients review deliverables directly in their dedicated portal and can approve work with a single click or submit structured revision requests with detailed change notes, ensuring feedback stays connected to specific deliverable versions.',
    },
    {
      q: 'How is my client work and data protected?',
      a: 'FlowDesk protects client information through strict workspace isolation, encrypted tokens, and secure database access controls. Clients can only access the workspaces, deliverables, and documents explicitly shared with them.',
    },
  ];

  return (
    <section id="faq" className="py-20 px-6 lg:px-12 max-w-4xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-14 space-y-3"
      >
        <h2 className="text-3xl sm:text-5xl font-extrabold text-[#F8F9FA] tracking-tight leading-tight">
          Frequently Asked Questions
        </h2>
        <p className="text-base sm:text-lg text-[#9CA3AF] max-w-2xl mx-auto leading-relaxed">
          Everything you need to know about managing client projects and billing with FlowDesk.
        </p>
      </motion.div>

      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          const answerId = `faq-answer-${idx}`;
          return (
            <div
              key={idx}
              className={`rounded-2xl border overflow-hidden transition-colors duration-200 ${
                isOpen
                  ? 'bg-[#181C1A] border-[#43D6B0]/50'
                  : 'bg-[#16181B] border-white/[0.08] hover:border-white/20'
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full flex items-center justify-between p-6 text-left font-bold text-[#F8F9FA] text-lg sm:text-xl focus:outline-none focus:ring-1 focus:ring-[#43D6B0]/50"
              >
                <span className="pr-4">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[#43D6B0]' : 'text-[#9CA3AF]'
                  }`}
                />
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    id={answerId}
                    role="region"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="px-6 pb-6 text-sm sm:text-base text-[#9CA3AF] border-t border-white/[0.08] pt-4 leading-relaxed overflow-hidden font-normal"
                  >
                    {faq.a}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
};
