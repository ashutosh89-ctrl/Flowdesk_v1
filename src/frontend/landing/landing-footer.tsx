import React from 'react';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';

export interface LandingFooterProps {
  onLaunchApp?: () => void;
  onOpenAuth?: (view: 'signup' | 'login') => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onOpenAuth }) => {
  return (
    <footer className="w-full bg-[#101312] border-t border-[#1E2623] py-10 px-6 lg:px-12 select-none relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <FlowDeskLogo variant="full" size="sm" />
        </div>

        <div className="flex items-center gap-6 text-sm text-[#A6B4AE]">
          <a href="#features" className="hover:text-[#F5F5F0] transition-colors">
            Features
          </a>
          <a href="#pricing" className="hover:text-[#F5F5F0] transition-colors">
            Pricing
          </a>
          <button
            type="button"
            onClick={() => onOpenAuth?.('login')}
            className="hover:text-[#F5F5F0] transition-colors"
          >
            Sign In
          </button>
          <a
            href="/client/login"
            className="hover:text-[#43D6B0] transition-colors"
          >
            Client Portal
          </a>
        </div>

        <p className="text-xs text-[#A6B4AE] font-mono">
          © 2026 FlowDesk. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

