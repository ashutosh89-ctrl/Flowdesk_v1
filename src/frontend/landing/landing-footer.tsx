import React from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Button } from '@/frontend/shared/ui/button';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { ArrowRight, ShieldCheck, Mail, Shield } from 'lucide-react';
import { siteConfig } from '@/shared/config/site-config';

export interface LandingFooterProps {
  onLaunchApp?: () => void;
  onOpenAuth?: (view: 'signup' | 'login') => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onLaunchApp, onOpenAuth }) => {
  return (
    <footer className="w-full bg-[#0A0A0A] border-t border-[#2A2A2A] select-none relative overflow-hidden">
      {/* Strong Final CTA Section with Liquid Light & Glass Frame */}
      <div className="py-24 px-6 lg:px-12 max-w-7xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: false, amount: 0.2 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-3xl p-10 sm:p-16 border border-[#2A2A2A] bg-[#111111]/90 backdrop-blur-3xl shadow-[0_30px_90px_rgba(0,0,0,0.9),inset_0_1px_0_0_rgba(255,255,255,0.08)] overflow-hidden"
        >
          {/* Subtle Ambient Liquid Glow inside CTA frame */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#0047AB]/20 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#2563EB]/15 rounded-full blur-[120px] pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto space-y-6">
            <span className="text-xs sm:text-[13px] font-mono uppercase tracking-widest text-[#E8F0FF] bg-[#0047AB]/20 px-4 py-1.5 rounded-full border border-[#2563EB]/30 font-semibold">
              Get Started Today
            </span>
            <h2 className="text-4xl sm:text-6xl lg:text-[64px] font-extrabold text-white tracking-tight leading-[1.08]">
              Ready to Take Control of Your Freelance Business?
            </h2>
            <p className="text-lg sm:text-xl lg:text-2xl text-zinc-200 max-w-3xl mx-auto leading-relaxed font-normal">
              Bring your clients, projects, deliverables, approvals, documents, and payments together. Spend less time managing work and more time growing your business.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => onOpenAuth?.('signup')}
                className="text-base sm:text-lg font-semibold px-9 py-4 shadow-[0_0_30px_rgba(0,71,171,0.4)] hover:shadow-[0_0_45px_rgba(0,71,171,0.6)] transition-all duration-300"
                rightIcon={<ArrowRight className="w-5 h-5" />}
              >
                Create Your Free Workspace
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => onOpenAuth?.('login')}
                className="text-base sm:text-lg font-medium px-9 py-4 hover:border-[#0047AB]/50 transition-all duration-300"
              >
                Sign In
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="pt-16 pb-12 px-6 lg:px-12 border-t border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-16 text-zinc-300">
          {/* Brand Overview Column */}
          <div className="sm:col-span-2 lg:col-span-2 space-y-4">
            <FlowDeskLogo variant="full" size="sm" />
            <p className="text-sm sm:text-base text-zinc-300 max-w-sm leading-relaxed font-normal">
              FlowDesk brings the moving parts of freelance client work into one organized workspace—from client onboarding to deliverable sign-offs and payment tracking.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                FlowDesk v1.0
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                Operated primarily in India
              </span>
            </div>
          </div>

          {/* Product Column */}
          <div>
            <h5 className="text-xs font-mono font-bold text-white uppercase tracking-widest mb-4">Product</h5>
            <ul className="space-y-3 text-sm text-zinc-300">
              <li><Link href="/#features" className="hover:text-white transition-colors">Workspace Features</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing & Plans</Link></li>
              <li><Link href="/about" className="hover:text-white transition-colors">About FlowDesk</Link></li>
              <li>
                <Link href="/client/login" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                  Client Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Column */}
          <div>
            <h5 className="text-xs font-mono font-bold text-white uppercase tracking-widest mb-4">Support</h5>
            <ul className="space-y-3 text-sm text-zinc-300">
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Support</Link></li>
              <li><Link href="/contact?category=Refund%20Request" className="hover:text-white transition-colors">Refund Inquiries</Link></li>
              <li><Link href="/contact?category=Subscription%20and%20Billing" className="hover:text-white transition-colors">Billing & Payments</Link></li>
              <li><Link href="/contact?category=Privacy%20and%20Data%20Deletion" className="hover:text-white transition-colors">Privacy Rights (DPDP)</Link></li>
              <li>
                <a href={`mailto:${siteConfig.supportEmail}`} className="hover:text-white transition-colors flex items-center gap-1.5 text-xs font-mono text-zinc-400 truncate">
                  <Mail className="w-3 h-3 text-zinc-400 shrink-0" />
                  {siteConfig.supportEmail}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h5 className="text-xs font-mono font-bold text-white uppercase tracking-widest mb-4">Legal</h5>
            <ul className="space-y-3 text-sm text-zinc-300">
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link></li>
              <li><Link href="/cancellation-policy" className="hover:text-white transition-colors">Cancellation Policy</Link></li>
              <li>
                <Link href="/security" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-zinc-400" />
                  Security Overview
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal & Copyright Bar */}
        <div className="max-w-7xl mx-auto pt-8 border-t border-[#2A2A2A] flex flex-col md:flex-row items-center justify-between text-xs sm:text-sm text-zinc-400 gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-center md:text-left">
            <p>© 2026 {siteConfig.brandName}. All rights reserved.</p>
            <div className="flex items-center gap-4 text-xs">
              <Link href="/terms" className="hover:text-white transition-colors underline-offset-4 hover:underline">Terms</Link>
              <span>•</span>
              <Link href="/privacy" className="hover:text-white transition-colors underline-offset-4 hover:underline">Privacy</Link>
              <span>•</span>
              <Link href="/refund-policy" className="hover:text-white transition-colors underline-offset-4 hover:underline">Refunds</Link>
              <span>•</span>
              <Link href="/cancellation-policy" className="hover:text-white transition-colors underline-offset-4 hover:underline">Cancellation</Link>
              <span>•</span>
              <Link href="/security" className="hover:text-white transition-colors underline-offset-4 hover:underline">Security</Link>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span>Built for independent freelancers and modern client workflows.</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
