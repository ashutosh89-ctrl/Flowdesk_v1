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
      q: 'Do my clients need an account to review work or access invoices?',
      a: 'No. Clients never need to create a FlowDesk account or remember passwords. They access their work via a dedicated, secure client portal using a direct magic link to review deliverables, submit revision requests, download documents, and view invoices.',
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
    <section id="faq" className="py-24 px-6 lg:px-12 max-w-4xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-16 space-y-4"
      >
        <span className="text-xs sm:text-[13px] font-mono uppercase tracking-widest text-[#43D6B0] bg-[#176B5B]/20 px-4 py-1.5 rounded-full border border-[#176B5B]/40 font-semibold">
          Got Questions? We&apos;ve Got Answers.
        </span>
        <h2 className="text-4xl sm:text-5xl lg:text-[50px] font-extrabold text-[#F5F5F0] tracking-tight leading-tight">
          Frequently Asked Questions
        </h2>
        <p className="text-lg sm:text-xl lg:text-[20px] text-[#A6B4AE] max-w-2xl mx-auto leading-relaxed font-normal">
          Find everything you need to know about managing your freelance workflow with FlowDesk.
        </p>
      </motion.div>

      <div className="space-y-4">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          const answerId = `faq-answer-${idx}`;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
              whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              viewport={{ once: false, amount: 0.15 }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className={`rounded-2xl border backdrop-blur-xl overflow-hidden transition-all duration-300 ${
                isOpen
                  ? 'bg-[#191F1D] border-[#176B5B] shadow-[0_4px_24px_rgba(23,107,91,0.15)]'
                  : 'bg-[#191F1D]/80 border-[#176B5B]/25 hover:border-[#43D6B0]/40'
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full flex items-center justify-between p-6 sm:p-7 text-left font-bold text-[#F5F5F0] text-lg sm:text-xl lg:text-[22px] focus:outline-none focus:ring-2 focus:ring-[#43D6B0]/50"
              >
                <span className="pr-4">{faq.q}</span>
                <ChevronDown
                  className={`w-6 h-6 shrink-0 transition-transform duration-300 ${
                    isOpen ? 'rotate-180 text-[#43D6B0]' : 'text-[#A6B4AE]'
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
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="px-6 sm:px-7 pb-6 sm:pb-7 text-base sm:text-lg lg:text-[18px] text-[#A6B4AE] border-t border-[#176B5B]/20 pt-4 sm:pt-5 leading-relaxed overflow-hidden font-normal"
                  >
                    {faq.a}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
