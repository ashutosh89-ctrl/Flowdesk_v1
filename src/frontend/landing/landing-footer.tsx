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
    <footer className="w-full bg-zinc-950 border-t border-white/10 select-none relative overflow-hidden">
      {/* Strong Final CTA Section with Liquid Light & Glass Frame */}
      <div className="py-24 px-6 lg:px-12 max-w-7xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl p-10 sm:p-16 border border-white/20 bg-zinc-900/90 backdrop-blur-3xl shadow-[0_30px_90px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.25)] overflow-hidden"
        >
          {/* Subtle Ambient Liquid Glow inside CTA frame */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/[0.08] rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/[0.06] rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto space-y-6">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 bg-white/10 px-3.5 py-1 rounded-full border border-white/15">
              Ready to Get Organized?
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
              Run your freelance workflow from one place.
            </h2>
            <p className="text-sm sm:text-base text-zinc-300 max-w-xl mx-auto leading-relaxed">
              Bring your clients, projects, deliverables, documents, approvals, invoices, and payment tracking together in one workspace.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => onOpenAuth?.('signup')}
                className="shadow-[0_0_30px_rgba(255,255,255,0.25)] hover:shadow-[0_0_45px_rgba(255,255,255,0.4)] transition-all duration-300"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Create Free Workspace
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => onOpenAuth?.('login')}
                className="hover:border-white/40 transition-all duration-300"
              >
                Sign In
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="pt-16 pb-12 px-6 lg:px-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 mb-16 text-zinc-400">
          {/* Brand Overview Column */}
          <div className="sm:col-span-2 md:col-span-1 space-y-4">
            <FlowDeskLogo variant="full" size="sm" />
            <p className="text-xs text-zinc-400 max-w-sm leading-relaxed font-normal">
              FlowDesk brings the moving parts of freelance work into one organized workspace, from client onboarding to payment tracking.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                FlowDesk v1.0
              </span>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h5 className="text-[11px] font-mono font-semibold text-white uppercase tracking-widest mb-4">Architecture</h5>
            <ul className="space-y-2.5 text-xs">
              <li><a href="#features" className="hover:text-white transition-colors">Client Workspaces</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Deliverables & Approvals</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Invoicing</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Client Portal</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Documents</a></li>
            </ul>
          </div>

          {/* Workflow & Resources Column */}
          <div>
            <h5 className="text-[11px] font-mono font-semibold text-white uppercase tracking-widest mb-4">Workflow</h5>
            <ul className="space-y-2.5 text-xs">
              <li><a href="#workflow" className="hover:text-white transition-colors">Freelance Workflow</a></li>
              <li><a href="#benefits" className="hover:text-white transition-colors">Benefits</a></li>
              <li><a href="#capabilities" className="hover:text-white transition-colors">Capabilities</a></li>
              <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
            </ul>
          </div>

          {/* Quick Access Column */}
          <div>
            <h5 className="text-[11px] font-mono font-semibold text-white uppercase tracking-widest mb-4">Quick Access</h5>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  type="button"
                  onClick={() => onOpenAuth?.('login')}
                  className="hover:text-white transition-colors text-left"
                >
                  Sign In
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onOpenAuth?.('signup')}
                  className="hover:text-white transition-colors text-left"
                >
                  Create Free Workspace
                </button>
              </li>
              <li>
                <a href="/client/login" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                  Client Portal Login
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal & Copyright Bar */}
        <div className="max-w-7xl mx-auto pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <div>
            <p>© 2026 FlowDesk. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-500">
            <span>Designed for independent freelancers and modern client work.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
