import React from 'react';
import { motion } from 'motion/react';
import { Button } from '@/frontend/shared/ui/button';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export interface LandingFooterProps {
  onLaunchApp?: () => void;
  onOpenAuth?: (view: 'signup' | 'login') => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onLaunchApp, onOpenAuth }) => {
  return (
    <footer className="w-full bg-[#101312] border-t border-[#176B5B]/20 select-none relative overflow-hidden">
      {/* Strong Final CTA Section with Glass Frame */}
      <div className="py-24 px-6 lg:px-12 max-w-7xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl p-10 sm:p-16 border border-[#176B5B]/30 bg-[#191F1D]/90 backdrop-blur-3xl shadow-[0_30px_90px_rgba(0,0,0,0.8)] overflow-hidden"
        >
          {/* Subtle Ambient Accent inside CTA frame */}
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-[#176B5B]/15 rounded-full blur-[120px] pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto space-y-6">
            <span className="text-xs sm:text-[13px] font-mono uppercase tracking-widest text-[#43D6B0] bg-[#176B5B]/20 px-4 py-1.5 rounded-full border border-[#176B5B]/40 font-semibold">
              Get Started Today
            </span>
            <h2 className="text-4xl sm:text-6xl lg:text-[64px] font-extrabold text-[#F5F5F0] tracking-tight leading-[1.08]">
              Ready to Take Control of Your Freelance Business?
            </h2>
            <p className="text-lg sm:text-xl lg:text-2xl text-[#A6B4AE] max-w-3xl mx-auto leading-relaxed font-normal">
              Bring your clients, projects, deliverables, approvals, documents, and payments together. Spend less time managing work and more time growing your business.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => onOpenAuth?.('signup')}
                className="text-base sm:text-lg font-semibold px-9 py-4 bg-[#43D6B0] text-[#101312] hover:bg-[#43D6B0]/90 shadow-[0_0_24px_rgba(67,214,176,0.3)] hover:shadow-[0_0_36px_rgba(67,214,176,0.45)] transition-all duration-300"
                rightIcon={<ArrowRight className="w-5 h-5" />}
              >
                Create Your Free Workspace
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => onOpenAuth?.('login')}
                className="text-base sm:text-lg font-medium px-9 py-4 bg-[#191F1D] text-[#F5F5F0] border border-[#176B5B]/40 hover:border-[#43D6B0]/60 transition-all duration-300"
              >
                Sign In
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="pt-16 pb-12 px-6 lg:px-12 border-t border-[#176B5B]/20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 mb-16 text-[#A6B4AE]">
          {/* Brand Overview Column */}
          <div className="sm:col-span-2 md:col-span-1 space-y-4">
            <FlowDeskLogo variant="full" size="sm" />
            <p className="text-base text-[#A6B4AE] max-w-sm leading-relaxed font-normal">
              FlowDesk brings the moving parts of freelance work into one organized workspace, from client onboarding to payment tracking.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#176B5B]/20 border border-[#176B5B]/40 text-xs font-mono text-[#43D6B0] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#43D6B0]" />
                FlowDesk v1.0
              </span>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h5 className="text-sm font-mono font-bold text-[#F5F5F0] uppercase tracking-widest mb-4">Features</h5>
            <ul className="space-y-3.5 text-base text-[#A6B4AE]">
              <li><a href="#features" className="hover:text-[#F5F5F0] transition-colors">Client Workspaces</a></li>
              <li><a href="#features" className="hover:text-[#F5F5F0] transition-colors">Deliverables & Approvals</a></li>
              <li><a href="#features" className="hover:text-[#F5F5F0] transition-colors">Invoicing</a></li>
              <li><a href="#features" className="hover:text-[#F5F5F0] transition-colors">Client Portal</a></li>
              <li><a href="#features" className="hover:text-[#F5F5F0] transition-colors">Documents</a></li>
            </ul>
          </div>

          {/* Workflow & Resources Column */}
          <div>
            <h5 className="text-sm font-mono font-bold text-[#F5F5F0] uppercase tracking-widest mb-4">Workflow</h5>
            <ul className="space-y-3.5 text-base text-[#A6B4AE]">
              <li><a href="#workflow" className="hover:text-[#F5F5F0] transition-colors">Freelance Workflow</a></li>
              <li><a href="#benefits" className="hover:text-[#F5F5F0] transition-colors">Benefits</a></li>
              <li><a href="#pricing" className="hover:text-[#F5F5F0] transition-colors">Pricing</a></li>
              <li><a href="#faq" className="hover:text-[#F5F5F0] transition-colors">FAQ</a></li>
            </ul>
          </div>

          {/* Quick Access Column */}
          <div>
            <h5 className="text-sm font-mono font-bold text-[#F5F5F0] uppercase tracking-widest mb-4">Quick Access</h5>
            <ul className="space-y-3.5 text-base text-[#A6B4AE]">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenAuth?.('login')}
                  className="hover:text-[#F5F5F0] transition-colors text-left"
                >
                  Sign In
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenAuth?.('signup')}
                  className="hover:text-[#F5F5F0] transition-colors text-left"
                >
                  Create Free Workspace
                </button>
              </li>
              <li>
                <a href="/client/login" className="hover:text-[#F5F5F0] transition-colors flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#A6B4AE]" />
                  Client Portal Login
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal & Copyright Bar */}
        <div className="max-w-7xl mx-auto pt-8 border-t border-[#176B5B]/20 flex flex-col sm:flex-row items-center justify-between text-base text-[#A6B4AE] gap-4">
          <div>
            <p>© 2026 FlowDesk. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm font-mono text-[#A6B4AE]">
            <span>Designed for independent freelancers and modern client work.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
