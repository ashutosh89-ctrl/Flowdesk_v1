'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/frontend/shared/ui/button';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import { ArrowRight, Menu, X, ChevronDown, Shield, FileText, RotateCcw } from 'lucide-react';

export interface LandingNavProps {
  onOpenAuth: (view: 'login' | 'signup') => void;
  onLaunchApp: () => void;
}

export const LandingNav: React.FC<LandingNavProps> = ({ onOpenAuth, onLaunchApp }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExploreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (exploreOpen) setExploreOpen(false);
        if (mobileMenuOpen) setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exploreOpen, mobileMenuOpen]);

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
    setExploreOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <header className="w-full h-20 px-6 lg:px-12 fixed top-0 left-0 right-0 z-50 bg-[#0D0E10]/95 border-b border-white/[0.08] flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center cursor-pointer group shrink-0" onClick={onLaunchApp}>
          <FlowDeskLogo variant="full" size="sm" priority className="group-hover:opacity-90 transition-opacity" />
        </div>

        {/* Desktop Centered Nav: Pricing, Features, FAQ + Policies Dropdown */}
        <nav className="hidden md:flex items-center gap-7 text-[15px] font-medium text-[#9CA3AF] absolute left-1/2 -translate-x-1/2">
          <a
            href="#pricing"
            className="relative py-1 text-[#9CA3AF] hover:text-white transition-colors duration-200 group"
          >
            <span>Pricing</span>
            <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#43D6B0] group-hover:w-full transition-all duration-300 ease-out" />
          </a>

          <a
            href="#features"
            className="relative py-1 text-[#9CA3AF] hover:text-white transition-colors duration-200 group"
          >
            <span>Features</span>
            <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#43D6B0] group-hover:w-full transition-all duration-300 ease-out" />
          </a>

          <a
            href="#faq"
            className="relative py-1 text-[#9CA3AF] hover:text-white transition-colors duration-200 group"
          >
            <span>FAQ</span>
            <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#43D6B0] group-hover:w-full transition-all duration-300 ease-out" />
          </a>

          {/* Simple Policies Button / Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setExploreOpen(!exploreOpen)}
              className="flex items-center gap-1.5 py-1 text-[#9CA3AF] hover:text-white transition-colors duration-200 focus:outline-none cursor-pointer group"
              aria-expanded={exploreOpen}
            >
              <span>Policies</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${exploreOpen ? 'rotate-180 text-[#43D6B0]' : 'text-[#9CA3AF]'}`} />
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#43D6B0] group-hover:w-full transition-all duration-300 ease-out" />
            </button>

            <AnimatePresence>
              {exploreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-[#141816] border border-[#176B5B]/40 rounded-2xl p-2 shadow-2xl z-50 backdrop-blur-xl"
                >
                  <Link
                    href="/terms"
                    onClick={() => setExploreOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#F5F5F0] hover:bg-[#176B5B]/25 hover:text-[#43D6B0] transition-colors text-left"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#43D6B0]" />
                    <span>Terms &amp; Conditions</span>
                  </Link>
                  <Link
                    href="/refund-policy"
                    onClick={() => setExploreOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#F5F5F0] hover:bg-[#176B5B]/25 hover:text-[#43D6B0] transition-colors text-left"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#43D6B0]" />
                    <span>Refund Policy</span>
                  </Link>
                  <Link
                    href="/cancellation-policy"
                    onClick={() => setExploreOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#F5F5F0] hover:bg-[#176B5B]/25 hover:text-[#43D6B0] transition-colors text-left"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#43D6B0]" />
                    <span>Cancellation Policy</span>
                  </Link>
                  <Link
                    href="/privacy"
                    onClick={() => setExploreOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#F5F5F0] hover:bg-[#176B5B]/25 hover:text-[#43D6B0] transition-colors text-left"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#43D6B0]" />
                    <span>Privacy Policy</span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Auth & CTA Actions (Desktop - Right Aligned) */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="md"
            className="text-base font-medium text-[#A6B4AE] hover:text-[#F5F5F0]"
            onClick={() => onOpenAuth('login')}
          >
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
              <div className="text-xs font-mono uppercase tracking-wider text-[#A6B4AE]/70">Menu</div>
              <nav className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleNavClick('#pricing')}
                  className="text-left text-base font-medium text-[#F5F5F0] py-2 hover:text-[#43D6B0]"
                >
                  Pricing
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('#features')}
                  className="text-left text-base font-medium text-[#F5F5F0] py-2 hover:text-[#43D6B0]"
                >
                  Features
                </button>
                <button
                  type="button"
                  onClick={() => handleNavClick('#faq')}
                  className="text-left text-base font-medium text-[#F5F5F0] py-2 hover:text-[#43D6B0]"
                >
                  FAQ
                </button>
                <div className="my-2 border-t border-[#176B5B]/20" />
                <div className="text-xs font-mono uppercase tracking-wider text-[#A6B4AE]/70 mb-1">Policies</div>
                <Link
                  href="/terms"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-left text-sm font-medium text-[#A6B4AE] py-1.5 hover:text-[#F5F5F0]"
                >
                  Terms &amp; Conditions
                </Link>
                <Link
                  href="/refund-policy"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-left text-sm font-medium text-[#A6B4AE] py-1.5 hover:text-[#F5F5F0]"
                >
                  Refund Policy
                </Link>
                <Link
                  href="/cancellation-policy"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-left text-sm font-medium text-[#A6B4AE] py-1.5 hover:text-[#F5F5F0]"
                >
                  Cancellation Policy
                </Link>
                <Link
                  href="/privacy"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-left text-sm font-medium text-[#A6B4AE] py-1.5 hover:text-[#F5F5F0]"
                >
                  Privacy Policy
                </Link>
              </nav>

              <div className="pt-4 border-t border-white/[0.08] flex flex-col gap-3">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full text-base font-bold py-3 shadow-md"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth('signup');
                  }}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Start for Free
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
};
