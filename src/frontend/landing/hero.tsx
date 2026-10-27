'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { Button } from '@/frontend/shared/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

export interface HeroProps {
  onLaunchApp: () => void;
  onOpenAuth: (view: 'signup' | 'login') => void;
}

export const Hero: React.FC<HeroProps> = ({ onLaunchApp, onOpenAuth }) => {
  const heroRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const contentY = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [0, 0] : [0, -50]
  );

  const contentOpacity = useTransform(
    scrollYProgress,
    [0, 0.85],
    shouldReduceMotion ? [1, 1] : [1, 0.1]
  );

  const bgOpacity = useTransform(
    scrollYProgress,
    [0, 0.75],
    shouldReduceMotion ? [1, 1] : [1, 0]
  );

  return (
    <section
      ref={heroRef}
      className="relative w-full overflow-hidden bg-[#101312] pt-24 pb-20 px-6 lg:px-12 flex flex-col items-center text-center"
    >
      {/* Restrained subtle ambient gradient background (no synthetic glow or particles) */}
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 pointer-events-none select-none overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#176B5B]/15 rounded-full blur-[140px]" />
      </motion.div>

      {/* Scroll-Linked Hero Content Container */}
      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="w-full max-w-5xl flex flex-col items-center text-center relative z-10"
      >
        {/* Subtle Restrained Category Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#191F1D] border border-[#176B5B]/40 text-xs sm:text-sm font-medium text-[#A6B4AE] mb-8 shadow-sm"
        >
          <span className="w-2 h-2 rounded-full bg-[#43D6B0]" />
          <span className="tracking-wider uppercase font-mono text-[12px] sm:text-[13px] text-[#F5F5F0] font-medium">
            Freelancer Operating System
          </span>
        </motion.div>

        {/* Editorial Headline with Instrument Serif Accent */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-7xl lg:text-[76px] font-bold tracking-tight text-[#F5F5F0] max-w-5xl leading-[1.08]"
        >
          Run Your Freelance Business.{' '}
          <span className="block font-serif italic text-[#43D6B0] mt-2 font-normal">
            All in One Place.
          </span>
        </motion.h1>

        {/* Subtitle in Clean Manrope */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg sm:text-xl lg:text-2xl text-[#A6B4AE] max-w-3xl mt-7 leading-relaxed font-normal"
        >
          From client intake to final payment, manage projects, deliverables, approvals, documents, and invoices through one connected workspace.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-center justify-center gap-4 mt-10"
        >
          <Button
            variant="primary"
            size="lg"
            onClick={() => onOpenAuth('signup')}
            className="text-base sm:text-lg font-bold px-8 py-4 shadow-lg shadow-[#43D6B0]/15 hover:shadow-xl hover:shadow-[#43D6B0]/25 transition-all duration-200"
            rightIcon={<ArrowRight className="w-5 h-5" />}
          >
            Start Managing Your Work — Free
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              const el = document.getElementById('features');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
              else onLaunchApp();
            }}
            className="text-base sm:text-lg font-medium px-8 py-4 bg-[#191F1D] text-[#F5F5F0] border border-[#176B5B]/40 hover:border-[#43D6B0]/60 hover:text-white transition-all duration-200"
          >
            Explore FlowDesk
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
};
