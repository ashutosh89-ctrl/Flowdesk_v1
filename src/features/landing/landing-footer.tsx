import React from 'react';
import { motion } from 'motion/react';
import { Button } from '../../components/ui/button';
import { ArrowRight, Twitter, Github, Linkedin } from 'lucide-react';

export interface LandingFooterProps {
  onLaunchApp?: () => void;
  onOpenAuth?: (view: 'signup') => void;
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
              Ready for Quiet Organization?
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-tight">
              Reclaim your focus with FlowDesk today.
            </h2>
            <p className="text-sm sm:text-base text-zinc-300 max-w-xl mx-auto leading-relaxed">
              Join thousands of independent freelancers, consultants, and boutique studios who manage their entire client business on one crystal-glass operating system.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Button
                variant="primary"
                size="lg"
                onClick={onLaunchApp}
                className="shadow-[0_0_30px_rgba(255,255,255,0.25)] hover:shadow-[0_0_45px_rgba(255,255,255,0.4)] transition-all duration-300"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Launch Workspace OS
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => onOpenAuth?.('signup')}
                className="hover:border-white/40 transition-all duration-300"
              >
                Create Free Account
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="pt-16 pb-12 px-6 lg:px-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-10 mb-16 text-zinc-400">
          {/* Brand Overview Column */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white text-zinc-950 flex items-center justify-center font-bold text-lg shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                F
              </div>
              <span className="text-lg font-bold tracking-tight text-white">FlowDesk</span>
            </div>
            <p className="text-xs text-zinc-400 max-w-sm leading-relaxed font-normal">
              FlowDesk simplifies freelance operations through one unified operating system. Crafted with crystal-glass precision and relentless monochrome polish.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                All Systems Operational
              </span>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h5 className="text-[11px] font-mono font-semibold text-white uppercase tracking-widest mb-4">Product</h5>
            <ul className="space-y-2.5 text-xs">
              <li><a href="#features" className="hover:text-white transition-colors">Client Workspaces</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Deliverable Engine</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Instant Invoicing</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Client Magic Portals</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Document Repository</a></li>
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h5 className="text-[11px] font-mono font-semibold text-white uppercase tracking-widest mb-4">Resources</h5>
            <ul className="space-y-2.5 text-xs">
              <li><a href="#workflow" className="hover:text-white transition-colors">Freelancer Playbook</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Rate Calculator</a></li>
              <li><a href="#faq" className="hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#faq" className="hover:text-white transition-colors">Changelog</a></li>
            </ul>
          </div>

          {/* Company & Legal Column */}
          <div>
            <h5 className="text-[11px] font-mono font-semibold text-white uppercase tracking-widest mb-4">Company</h5>
            <ul className="space-y-2.5 text-xs">
              <li><a href="#manifesto" className="hover:text-white transition-colors">Manifesto</a></li>
              <li><a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#terms" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#support" className="hover:text-white transition-colors">Support & Contact</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal & Copyright Bar */}
        <div className="max-w-7xl mx-auto pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <div>
            <p>© 2026 FlowDesk Technologies. Designed for modern independent businesses. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-white transition-colors"><Twitter className="w-4 h-4" /></a>
            <a href="#" className="hover:text-white transition-colors"><Github className="w-4 h-4" /></a>
            <a href="#" className="hover:text-white transition-colors"><Linkedin className="w-4 h-4" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
};
