import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/frontend/shared/ui/button';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { ArrowRight, Menu, X } from 'lucide-react';

export interface LandingNavProps {
  onOpenAuth: (view: 'login' | 'signup') => void;
  onLaunchApp: () => void;
}

export const LandingNav: React.FC<LandingNavProps> = ({ onOpenAuth, onLaunchApp }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Pricing', href: '#pricing' },
    { label: 'Features', href: '#features' },
    { label: 'FAQ', href: '#faq' },
  ];

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="w-full h-20 px-6 lg:px-12 fixed top-0 left-0 right-0 z-50 bg-[#0D0E10]/95 border-b border-white/[0.08] flex items-center justify-between">
      {/* Brand Logo */}
      <div className="flex items-center cursor-pointer group" onClick={onLaunchApp}>
        <FlowDeskLogo variant="full" size="sm" priority className="group-hover:opacity-90 transition-opacity" />
      </div>

      {/* Desktop Nav Links Perfectly Centered in Viewport */}
      <nav className="hidden md:flex items-center gap-8 text-[15px] font-medium text-[#9CA3AF] absolute left-1/2 -translate-x-1/2">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="relative py-1 text-[#9CA3AF] hover:text-white transition-colors duration-200 group"
          >
            <span>{item.label}</span>
            <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#43D6B0] group-hover:w-full transition-all duration-300 ease-out" />
          </a>
        ))}
      </nav>

      {/* Auth & CTA Actions (Desktop) */}
      <div className="hidden md:flex items-center gap-3">
        <Button variant="ghost" size="md" className="text-base font-medium text-[#A6B4AE] hover:text-[#F5F5F0]" onClick={() => onOpenAuth('login')}>
          Sign In
        </Button>
        <Button
          variant="primary"
          size="md"
          className="text-base font-bold px-5 py-2.5 shadow-sm"
          onClick={() => onOpenAuth('signup')}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Start for Free
        </Button>
      </div>

      {/* Mobile Menu Toggle Button */}
      <div className="flex items-center gap-2 md:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenAuth('login')}
          className="text-sm px-2.5 py-1 text-[#A6B4AE] hover:text-[#F5F5F0]"
        >
          Sign In
        </Button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          className="p-2 rounded-xl bg-[#191F1D] border border-[#176B5B]/40 text-[#A6B4AE] hover:text-[#F5F5F0] hover:bg-[#176B5B]/20 transition-colors focus:outline-none focus:ring-2 focus:ring-[#43D6B0]/40"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden fixed top-20 left-0 right-0 bg-[#101312] border-b border-[#176B5B]/30 px-6 py-6 shadow-2xl flex flex-col gap-5 z-40 max-h-[calc(100vh-5rem)] overflow-y-auto"
          >
            <nav className="flex flex-col gap-3">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item.href)}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl text-left text-base font-medium text-[#A6B4AE] hover:text-[#F5F5F0] hover:bg-[#191F1D] transition-colors border border-transparent hover:border-[#176B5B]/30"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#176B5B]" />
                </button>
              ))}
            </nav>

            <div className="pt-4 border-t border-[#176B5B]/30 flex flex-col gap-2.5">
              <Button
                variant="primary"
                className="w-full justify-center py-3 text-base font-bold"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('signup');
                }}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Start for Free
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center py-3 text-sm font-semibold bg-[#191F1D] text-[#F5F5F0] border-[#176B5B]/40"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('login');
                }}
              >
                Sign In
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
