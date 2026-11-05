import React from 'react';
import Link from 'next/link';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { ShieldCheck, Mail, Shield } from 'lucide-react';
import { siteConfig } from '@/shared/config/site-config';

export interface LandingFooterProps {
  onLaunchApp?: () => void;
  onOpenAuth?: (view: 'signup' | 'login') => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onOpenAuth }) => {
  return (
    <footer className="w-full bg-[#0D0E10] border-t border-white/[0.08] pt-16 pb-12 px-6 lg:px-12 select-none">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12 text-[#9CA3AF]">
        {/* Brand Overview Column */}
        <div className="sm:col-span-2 lg:col-span-2 space-y-4">
          <FlowDeskLogo variant="full" size="sm" />
          <p className="text-sm text-[#9CA3AF] max-w-sm leading-relaxed font-normal">
            FlowDesk brings the moving parts of freelance client work into one organized workspace—from client onboarding to deliverable sign-offs and payment tracking.
          </p>
          <div className="pt-1 text-xs text-[#9CA3AF]/60">
            Operated primarily in India
          </div>
        </div>

        {/* Product Column */}
        <div>
          <h5 className="text-xs font-mono font-bold text-[#F5F5F0] uppercase tracking-widest mb-4">Product</h5>
          <ul className="space-y-3 text-sm text-[#9CA3AF]">
            <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
            <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing &amp; Plans</Link></li>
            <li><Link href="/about" className="hover:text-white transition-colors">About FlowDesk</Link></li>
            <li>
              <Link href="/client/login" className="hover:text-white transition-colors flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#43D6B0]" />
                Client Portal
              </Link>
            </li>
          </ul>
        </div>

        {/* Support Column */}
        <div>
          <h5 className="text-xs font-mono font-bold text-[#F5F5F0] uppercase tracking-widest mb-4">Support</h5>
          <ul className="space-y-3 text-sm text-[#9CA3AF]">
            <li><Link href="/contact" className="hover:text-white transition-colors">Contact Support</Link></li>
            <li><Link href="/contact?category=Refund%20Request" className="hover:text-white transition-colors">Refund Inquiries</Link></li>
            <li><Link href="/contact?category=Subscription%20and%20Billing" className="hover:text-white transition-colors">Billing &amp; Payments</Link></li>
            <li><Link href="/contact?category=Privacy%20and%20Data%20Deletion" className="hover:text-white transition-colors">Privacy Rights (DPDP)</Link></li>
            <li>
              <a href={`mailto:${siteConfig.supportEmail}`} className="hover:text-white transition-colors flex items-center gap-1.5 text-xs font-mono text-[#9CA3AF]/70 truncate">
                <Mail className="w-3 h-3 text-[#43D6B0] shrink-0" />
                {siteConfig.supportEmail}
              </a>
            </li>
          </ul>
        </div>

        {/* Legal Column */}
        <div>
          <h5 className="text-xs font-mono font-bold text-[#F5F5F0] uppercase tracking-widest mb-4">Legal</h5>
          <ul className="space-y-3 text-sm text-[#9CA3AF]">
            <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            <li><Link href="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link></li>
            <li><Link href="/cancellation-policy" className="hover:text-white transition-colors">Cancellation Policy</Link></li>
            <li>
              <Link href="/security" className="hover:text-white transition-colors flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#43D6B0]" />
                Security Overview
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="max-w-7xl mx-auto pt-8 border-t border-white/[0.08] flex flex-col md:flex-row items-center justify-between text-xs text-[#9CA3AF] gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-center md:text-left">
          <p>© {new Date().getFullYear()} {siteConfig.brandName}. All rights reserved.</p>
          <div className="flex items-center gap-3">
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

        {onOpenAuth && (
          <div className="flex items-center gap-4 text-xs font-medium">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="text-[#43D6B0] hover:underline transition-colors"
            >
              Sign In
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => onOpenAuth('signup')}
              className="text-[#F5F5F0] hover:underline transition-colors"
            >
              Create Free Workspace
            </button>
          </div>
        )}
      </div>
    </footer>
  );
};
