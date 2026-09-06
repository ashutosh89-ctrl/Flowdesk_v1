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
    { label: 'Features', href: '#features' },
    { label: 'Workflow', href: '#workflow' },
    { label: 'Benefits', href: '#benefits' },
    { label: 'Capabilities', href: '#capabilities' },
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
    <header className="w-full h-20 px-6 lg:px-12 fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-3xl border-b border-white/10 flex items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
      {/* Brand Logo */}
      <div className="flex items-center gap-2.5 cursor-pointer group" onClick={onLaunchApp}>
        <FlowDeskLogo variant="full" size="sm" priority className="group-hover:opacity-90 transition-opacity" />
        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/15">
          v1.0
        </span>
      </div>

      {/* Desktop Nav Links with Illumination Underline Micro-Motion */}
      <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-zinc-400">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="relative py-1 text-zinc-400 hover:text-white transition-colors duration-200 group"
          >
            <span>{item.label}</span>
            <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] group-hover:w-full transition-all duration-300 ease-out" />
          </a>
        ))}
      </nav>

      {/* Auth & CTA Actions (Desktop) */}
      <div className="hidden md:flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => onOpenAuth('login')}>
          Sign In
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onOpenAuth('signup')}
          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
        >
          Create Free Workspace
        </Button>
      </div>

      {/* Mobile Menu Toggle Button */}
      <div className="flex items-center gap-2 md:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenAuth('login')}
          className="text-xs px-2.5 py-1"
        >
          Sign In
        </Button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
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
            className="md:hidden fixed top-20 left-0 right-0 bg-zinc-950/95 backdrop-blur-3xl border-b border-white/15 px-6 py-6 shadow-2xl flex flex-col gap-5 z-40 max-h-[calc(100vh-5rem)] overflow-y-auto"
          >
            <nav className="flex flex-col gap-3">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item.href)}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl text-left text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                </button>
              ))}
            </nav>

            <div className="pt-4 border-t border-white/10 flex flex-col gap-2.5">
              <Button
                variant="primary"
                className="w-full justify-center py-2.5 text-xs font-semibold"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('signup');
                }}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Create Free Workspace
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center py-2.5 text-xs font-semibold"
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
