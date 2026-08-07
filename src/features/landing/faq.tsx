import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does FlowDesk differ from standard CRMs or Notion templates?',
      a: 'FlowDesk is built ground-up as a specialized Freelancer Operating System with crystal glass UX. Unlike bloated CRMs or fragile Notion setups, FlowDesk seamlessly connects client workspaces directly to deliverable approvals, versioned documents, and instant invoices.',
    },
    {
      q: 'Do my clients need to create an account to view deliverables?',
      a: 'No! FlowDesk generates secure zero-friction Client Magic Portals. You share a unique workspace link, and clients can view project timelines, sign off deliverables, and pay invoices instantly without passwords.',
    },
    {
      q: 'Can I customize my invoice currency and tax rates?',
      a: 'Yes. FlowDesk supports multi-currency options (USD, EUR, GBP, JPY, CAD) and lets you set custom hourly rates and local tax preferences in Settings.',
    },
    {
      q: 'Is my client data private and isolated?',
      a: 'Every client workspace is logically isolated. Work, documents, and comments remain strictly accessible only to you and the designated client portal view.',
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
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full flex items-center justify-between p-6 text-left font-semibold text-white text-base"
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
