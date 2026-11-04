'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { Button } from '@/frontend/shared/ui/button';
import { ArrowRight } from 'lucide-react';
import GlowCursor from './GlowCursor';

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
    shouldReduceMotion ? [0, 0] : [0, -40]
  );

  const contentOpacity = useTransform(
    scrollYProgress,
    [0, 0.85],
    shouldReduceMotion ? [1, 1] : [1, 0.1]
  );

  return (
    <GlowCursor
      color="#43D6B0"
      secondaryColor="#176B5B"
      intensity={2.8}
      trailWidth={7.5}
      linger={1.8}
      glow={2.2}
      hotspot={1.4}
      className="w-full relative"
    >
      <section
        ref={heroRef}
        className="relative w-full overflow-hidden bg-transparent pt-28 pb-24 px-6 lg:px-12 flex flex-col items-center text-center select-none"
      >
        {/* Scroll-Linked Hero Content Container */}
        <motion.div
          style={{ y: contentY, opacity: contentOpacity }}
          className="w-full max-w-4xl flex flex-col items-center text-center relative z-10"
        >
          {/* Editorial Headline with Instrument Serif Accent */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-7xl lg:text-[80px] font-bold tracking-tight text-[#F5F5F0] max-w-4xl leading-[1.08]"
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
            transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center justify-center gap-4 mt-12"
          >
            <Button
              variant="primary"
              size="lg"
              onClick={() => onOpenAuth('signup')}
              className="text-base sm:text-lg font-bold px-9 py-4 shadow-md transition-all duration-200"
              rightIcon={<ArrowRight className="w-5 h-5" />}
            >
              Start for Free
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                const el = document.getElementById('features');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else onLaunchApp();
              }}
              className="text-base sm:text-lg font-medium px-9 py-4 bg-[#191F1D] text-[#F5F5F0] border border-[#176B5B]/40 hover:border-[#43D6B0]/60 hover:text-white transition-all duration-200"
            >
              Explore Features
            </Button>
          </motion.div>
        </motion.div>
      </section>
    </GlowCursor>
  );
};
