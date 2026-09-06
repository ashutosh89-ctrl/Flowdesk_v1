import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How is FlowDesk different from a project management tool?',
      a: 'FlowDesk is designed around the complete freelancer-client workflow, connecting client work, projects, deliverables, approvals, documents, invoices, and payment tracking in one workspace.',
    },
    {
      q: 'Do clients need an account?',
      a: 'Clients use the dedicated client portal to access the work shared with them. The exact access flow depends on the portal setup for their workspace.',
    },
    {
      q: 'Can I create professional invoices?',
      a: 'Yes. FlowDesk lets you create itemized invoices with configurable taxes, supported currencies, payment terms, discounts where available, and professional PDF and print output.',
    },
    {
      q: 'Can I accept payments through FlowDesk?',
      a: 'FlowDesk currently focuses on invoice creation and payment tracking. You can record payments received and keep outstanding balances organized.',
    },
    {
      q: 'Can clients request revisions?',
      a: 'Yes. Clients can review deliverables and submit structured revision requests so feedback stays connected to the work being reviewed.',
    },
    {
      q: 'How is my client work protected?',
      a: 'FlowDesk keeps client work organized within the appropriate workspace and controls access to information based on the user’s role and workspace.',
    },
  ];

  return (
    <section id="faq" className="py-24 px-6 lg:px-12 max-w-4xl mx-auto relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: false, amount: 0.2 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-16 space-y-3"
      >
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">Questions & Answers</span>
        <h2 className="text-3xl font-bold text-white tracking-tight">Frequently Asked Questions</h2>
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
              className="rounded-2xl bg-zinc-900/60 border border-white/10 backdrop-blur-xl overflow-hidden transition-all duration-300 hover:border-white/25"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full flex items-center justify-between p-6 text-left font-semibold text-white text-base focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-zinc-400 transition-transform duration-300 ${
                    isOpen ? 'rotate-180 text-white' : ''
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
                    className="px-6 pb-6 text-sm text-zinc-300 border-t border-white/5 pt-4 leading-relaxed overflow-hidden"
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
