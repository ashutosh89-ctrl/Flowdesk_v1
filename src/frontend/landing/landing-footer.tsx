import React from 'react';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';

export interface LandingFooterProps {
  onLaunchApp?: () => void;
  onOpenAuth?: (view: 'signup' | 'login') => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onLaunchApp, onOpenAuth }) => {
  return (
    <footer className="w-full bg-[#0D0E10] border-t border-white/[0.08] py-8 px-6 lg:px-12 select-none">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#9CA3AF]">
        <div className="flex items-center gap-3">
          <FlowDeskLogo variant="full" size="sm" />
          <span className="text-xs text-[#9CA3AF]/60 hidden sm:inline">•</span>
          <span className="text-xs text-[#9CA3AF]/70 font-normal">
            © {new Date().getFullYear()} FlowDesk. All rights reserved.
          </span>
        </div>

        <div className="flex items-center gap-6 text-xs font-medium text-[#9CA3AF]">
          <a href="#pricing" className="hover:text-white transition-colors">
            Pricing
          </a>
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#faq" className="hover:text-white transition-colors">
            FAQ
          </a>
          {onOpenAuth && (
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="text-[#43D6B0] hover:underline transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
