import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/frontend/shared/ui/button';
import { ArrowRight } from 'lucide-react';
import GlowCursor from './GlowCursor';

export interface HeroProps {
  onLaunchApp: () => void;
  onOpenAuth: (view: 'signup' | 'login') => void;
}

export const Hero: React.FC<HeroProps> = ({ onLaunchApp, onOpenAuth }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, px: 0, py: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setMousePos({ x, y, px, py });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0, px: 0, py: 0 });
  };

  return (
    <section
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full overflow-hidden"
    >
      <GlowCursor
        color="#2563EB"
        intensity={0.9}
        trailWidth={3}
        linger={3.4}
        glow={1.8}
        clickBurst
        theme="dark"
        className="w-full min-h-[90vh] pt-32 pb-28 px-6 lg:px-12 flex flex-col items-center text-center select-none"
      >
        <div className="w-full flex flex-col items-center text-center">

      {/* Subtle Premium Badge */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="inline-flex items-center gap-2.5 px-4.5 py-2 rounded-full bg-[#0A0A0A]/90 border border-[#2563EB]/40 backdrop-blur-2xl text-sm sm:text-[14px] font-medium text-zinc-200 mb-8 shadow-[0_8px_32px_rgba(0,71,171,0.25),inset_0_1px_0_0_rgba(37,99,235,0.3)]"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] shadow-[0_0_12px_rgba(37,99,235,1)] animate-pulse" />
        <span className="tracking-widest uppercase font-mono text-[13px] sm:text-[14px] text-[#E8F0FF] font-semibold">Operating System for Freelancers</span>
      </motion.div>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="text-5xl sm:text-7xl lg:text-[76px] font-extrabold tracking-tight text-white max-w-5xl leading-[1.08]"
      >
        Run Your Freelance Business.{' '}
        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400 font-extrabold mt-2 tracking-tight">
          All in One Place.
        </span>
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="text-xl sm:text-2xl text-zinc-200 max-w-3xl mt-7 leading-relaxed font-normal"
      >
        From your first client conversation to final payment, manage projects, deliverables, approvals, documents, and invoices through one seamless workspace.
      </motion.p>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-center justify-center gap-4 mt-10 z-20"
      >
        <Button
          variant="primary"
          size="lg"
          onClick={() => onOpenAuth('signup')}
          className="text-base sm:text-lg font-semibold shadow-[0_0_30px_rgba(0,71,171,0.4)] hover:shadow-[0_0_45px_rgba(0,71,171,0.6)] transition-all duration-300 px-8 py-4"
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
          className="text-base sm:text-lg font-medium hover:border-[#0047AB]/50 transition-all duration-300 px-8 py-4"
        >
          Explore FlowDesk
        </Button>
      </motion.div>
      </div>
    </GlowCursor>
  </section>
  );
};
