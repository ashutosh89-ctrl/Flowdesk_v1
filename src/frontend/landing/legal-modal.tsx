'use client';

import React, { useState } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { FileText, Shield, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';

export type LegalTab = 'terms' | 'refund' | 'cancellation';

export interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: LegalTab;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'terms',
}) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Legal & Compliance Policies"
      description="Transparent, fair terms governing your FlowDesk account, subscriptions, and client operations."
      size="xl"
    >
      <div className="space-y-6 pt-2">
        {/* Tab Switcher */}
        <div className="flex border-b border-[#176B5B]/30 gap-2 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'terms'
                ? 'bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/50'
                : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
            }`}
          >
            <FileText className="w-4 h-4" />
            Terms &amp; Conditions
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('refund')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'refund'
                ? 'bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/50'
                : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Refund Policy
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cancellation')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'cancellation'
                ? 'bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/50'
                : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
            }`}
          >
            <Shield className="w-4 h-4" />
            Cancellation Policy
          </button>
        </div>

        {/* Tab Content */}
        <div className="max-h-[60vh] overflow-y-auto pr-2 text-sm leading-relaxed text-[#A6B4AE] space-y-4 font-sans">
          {activeTab === 'terms' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#F5F5F0]">1. Acceptance of Terms</h3>
              <p>
                By accessing or using FlowDesk, you agree to be bound by these Terms and Conditions.
                FlowDesk provides operations management software for freelancers and digital studios to organize
                client projects, deliverable reviews, approvals, invoicing, and contract management.
              </p>

              <h3 className="text-base font-bold text-[#F5F5F0]">2. Account &amp; Workspace Security</h3>
              <p>
                You are responsible for safeguarding your credentials and session access. You may not share accounts,
                bypass subscription limits, or upload malicious code. Freelancers retain full ownership of their work,
                deliverables, client data, and local files.
              </p>

              <h3 className="text-base font-bold text-[#F5F5F0]">3. Freelancer-Client Relationships</h3>
              <p>
                FlowDesk provides technology infrastructure to facilitate direct communication, deliverable reviews,
                and invoice generation. FlowDesk is not an employer, agency, or escrow broker. Freelancers and clients
                maintain direct contractual relationships.
              </p>

              <h3 className="text-base font-bold text-[#F5F5F0]">4. Data Storage &amp; Privacy</h3>
              <p>
                FlowDesk employs a privacy-first hybrid architecture: application metadata and operational states are stored
                in encrypted cloud databases, while large deliverables and project documents can remain strictly on the
                freelancer’s local device until explicitly shared.
              </p>

              <h3 className="text-base font-bold text-[#F5F5F0]">5. Service Availability &amp; Modifications</h3>
              <p>
                We strive for 99.9% platform availability. FlowDesk reserves the right to make improvements, update features,
                and maintain infrastructure with reasonable advance notice whenever possible.
              </p>
            </div>
          )}

          {activeTab === 'refund' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#F5F5F0]">1. 7-Day Money-Back Guarantee</h3>
              <p>
                We want you to be completely satisfied with FlowDesk. If you upgrade to a paid plan (Standard or Studio)
                and find it does not suit your freelance practice, you are eligible for a full refund within 7 calendar days
                of your initial subscription upgrade.
              </p>

              <h3 className="text-base font-bold text-[#F5F5F0]">2. Refund Eligibility &amp; Process</h3>
              <p>
                To request a refund, submit a request via support or email with your registered workspace email and invoice
                number. Verified requests will be processed through Razorpay back to your original payment method within
                5 to 7 business days.
              </p>

              <h3 className="text-base font-bold text-[#F5F5F0]">3. Subsequent Renewal Cycles</h3>
              <p>
                Refunds apply to the initial billing cycle. Recurring annual or monthly renewals must be canceled prior to
                the renewal date to avoid automatic charges. In cases of billing discrepancies or unauthorized charges, our
                support team is available for prompt review.
              </p>
            </div>
          )}

          {activeTab === 'cancellation' && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-[#F5F5F0]">1. Cancel Anytime</h3>
              <p>
                You may cancel your FlowDesk paid subscription at any time directly from your dashboard under
                <strong className="text-white"> Settings &rarr; Platform Subscription &rarr; Cancel</strong>.
                There are no cancellation fees, lockout penalties, or minimum commitment periods.
              </p>

              <h3 className="text-base font-bold text-[#F5F5F0]">2. Continued Access Until Cycle End</h3>
              <p>
                When you cancel, your workspace retains full Standard or Studio entitlements until the end of your prepaid
                billing period. At the end of the period, your workspace transitions gracefully to the Free Starter plan.
              </p>

              <h3 className="text-base font-bold text-[#F5F5F0]">3. Data Preservation Guarantee</h3>
              <p>
                We never hold your data hostage. Even after transitioning to the Free tier, your existing clients, projects,
                invoices, documents, and deliverables remain preserved and accessible in read-only or standard mode.
                You can export your complete workspace records as CSV anytime.
              </p>
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className="p-3 bg-[#101312] border border-[#176B5B]/20 rounded-xl flex items-center justify-between text-xs text-[#A6B4AE]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#43D6B0]" />
            <span>Effective as of {new Date().getFullYear()} • FlowDesk Technologies</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-[#43D6B0] hover:underline"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

