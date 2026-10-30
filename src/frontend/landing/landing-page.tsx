'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import { LandingNav } from './landing-nav';
import { Hero } from './hero';
import { FeatureShowcase } from './feature-showcase';
import { PricingPreview } from './pricing-preview';
import { FAQSection } from './faq';
import { LandingFooter } from './landing-footer';

export interface LandingPageProps {
  onLaunchApp: () => void;
  onOpenAuth: (view: 'login' | 'signup') => void;
}

/**
 * ScrollSectionReveal — Bidirectional scroll appearance and disappearance transition.
 * When scrolling down: scales in, translates up, fades in.
 * When scrolling past: smoothly scales down, translates up, and fades out.
 * When scrolling up: the entire transition dynamically reverses in real-time!
 */
const ScrollSectionReveal: React.FC<{
  children: React.ReactNode;
  id?: string;
  className?: string;
}> = ({ children, id, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const opacity = useTransform(
    scrollYProgress,
    [0, 0.2, 0.8, 1],
    shouldReduceMotion ? [1, 1, 1, 1] : [0, 1, 1, 0]
  );

  const scale = useTransform(
    scrollYProgress,
    [0, 0.2, 0.8, 1],
    shouldReduceMotion ? [1, 1, 1, 1] : [0.94, 1, 1, 0.94]
  );

  const y = useTransform(
    scrollYProgress,
    [0, 0.2, 0.8, 1],
    shouldReduceMotion ? [0, 0, 0, 0] : [45, 0, 0, -45]
  );

  return (
    <motion.div
      ref={ref}
      id={id}
      style={{ opacity, scale, y }}
      className={`will-change-transform ${className}`}
    >
      {children}
    </motion.div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp, onOpenAuth }) => {
  // Track cursor position for page-wide ambient neon glow aura
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });
  const [isHovering, setIsHovering] = useState(false);

  // Hide browser scrollbar on landing page while keeping smooth scroll
  useEffect(() => {
    document.documentElement.classList.add('no-scrollbar');
    document.body.classList.add('no-scrollbar');

    const handlePointerMove = (e: PointerEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      setIsHovering(true);
    };

    const handlePointerLeave = () => {
      setIsHovering(false);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      document.documentElement.classList.remove('no-scrollbar');
      document.body.classList.remove('no-scrollbar');
      window.removeEventListener('pointermove', handlePointerMove);
      document.documentElement.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0D0E10] text-[#F8F9FA] selection:bg-[#43D6B0] selection:text-[#0D0E10] font-sans relative overflow-x-hidden no-scrollbar">
      {/* High-intensity ambient cursor glow across the entire landing page */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500 ease-out"
        style={{
          opacity: isHovering ? 1 : 0,
          background: `radial-gradient(650px circle at ${mousePos.x}px ${mousePos.y}px, rgba(67, 214, 176, 0.16), rgba(23, 107, 91, 0.05) 50%, transparent 80%)`,
        }}
        aria-hidden="true"
      />

      <LandingNav onOpenAuth={onOpenAuth} onLaunchApp={onLaunchApp} />
      <main className="pt-20 relative z-10 space-y-6">
        <Hero onLaunchApp={onLaunchApp} onOpenAuth={onOpenAuth} />

        <ScrollSectionReveal id="pricing-reveal">
          <PricingPreview onOpenAuth={onOpenAuth} onLaunchApp={onLaunchApp} />
        </ScrollSectionReveal>

        <ScrollSectionReveal id="features-reveal">
          <FeatureShowcase />
        </ScrollSectionReveal>

        <ScrollSectionReveal id="faq-reveal">
          <FAQSection />
        </ScrollSectionReveal>
      </main>
      <LandingFooter onLaunchApp={onLaunchApp} onOpenAuth={onOpenAuth} />
    </div>
  );
};
