import React, { useState } from 'react';
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
    <section id="faq" className="py-20 px-6 lg:px-12 max-w-4xl mx-auto">
      <div className="text-center mb-16 space-y-3">
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">Questions & Answers</span>
        <h2 className="text-3xl font-bold text-white">Frequently Asked Questions</h2>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl bg-zinc-900/60 border border-white/10 backdrop-blur-xl overflow-hidden transition-colors"
            >
              <button
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full flex items-center justify-between p-6 text-left font-semibold text-white text-base"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-zinc-400 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-white' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-6 pb-6 text-sm text-zinc-400 border-t border-white/5 pt-4 leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
