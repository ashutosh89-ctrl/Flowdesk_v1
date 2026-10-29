'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { Button } from '@/frontend/shared/ui/button';
import { ArrowRight } from 'lucide-react';

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
      className="relative w-full overflow-hidden bg-[#101312] pt-28 pb-24 px-6 lg:px-12 flex flex-col items-center text-center"
    >
      {/* Subtle ambient light gradient background */}
      <div
        className="absolute inset-0 pointer-events-none select-none overflow-hidden z-[1]"
        aria-hidden="true"
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#176B5B]/10 rounded-full blur-[130px]" />
      </div>

      {/* Hero Content Container */}
      <div className="w-full max-w-5xl flex flex-col items-center text-center relative z-10">
        {/* Editorial Headline with Instrument Serif Accent */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-7xl lg:text-[76px] font-bold tracking-tight text-[#F5F5F0] max-w-5xl leading-[1.08]"
        >
          Run Your Freelance Business.{' '}
          <span className="block font-serif italic text-[#43D6B0] mt-3 font-normal">
            All in One Place.
          </span>
        </motion.h1>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-center justify-center gap-4 mt-12"
        >
          <Button
            variant="primary"
            size="lg"
            onClick={() => onOpenAuth('signup')}
            className="text-base sm:text-lg font-bold px-8 py-4 shadow-md transition-all duration-200"
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
            className="text-base sm:text-lg font-medium px-8 py-4 bg-[#141816] text-[#F5F5F0] border border-[#212B27] hover:border-[#43D6B0]/50 hover:text-white transition-all duration-200"
          >
            Explore FlowDesk
          </Button>
        </motion.div>
      </div>
    </section>
  );
};
