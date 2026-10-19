import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/frontend/shared/ui/button';
import { ArrowRight, CheckCircle2, Terminal } from 'lucide-react';
import GlowCursor from './GlowCursor';

export interface HeroProps {
  onLaunchApp: () => void;
  onOpenAuth: (view: 'signup' | 'login') => void;
}

export const Hero: React.FC<HeroProps> = ({ onLaunchApp, onOpenAuth }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, px: 0, py: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setMousePos({ x, y, px, py });
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
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

      {/* Floating Crystal Glass Dashboard Showcase Preview with Idle & Mouse Tilt */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{
          opacity: 1,
          y: [0, -4, 0],
        }}
        transition={{
          opacity: { duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] },
          y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="w-full max-w-5xl mt-16 relative perspective-1000 z-10"
        style={{
          transform: `rotateY(${mousePos.x * 2.5}deg) rotateX(${-mousePos.y * 2.5}deg) translateY(${mousePos.y * -4}px)`,
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Crystal Glass Border Frame */}
        <div className="relative rounded-2xl border border-[#2A2A2A] bg-[#0A0A0A]/90 backdrop-blur-3xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95),inset_0_1px_0_0_rgba(255,255,255,0.06)] p-6 sm:p-8 overflow-hidden group hover:border-[#2563EB]/40 transition-all duration-500">
          {/* Glass Cursor Reflection Highlight */}
          {isHovered && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle 350px at ${mousePos.px}px ${mousePos.py}px, rgba(37, 99, 235, 0.1), transparent 70%)`,
              }}
            />
          )}

          {/* Mock Window Top Bar */}
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#2A2A2A] text-sm text-zinc-400 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-zinc-800 border border-[#2A2A2A]" />
              <div className="w-3 h-3 rounded-full bg-zinc-800 border border-[#2A2A2A]" />
              <div className="w-3 h-3 rounded-full bg-zinc-800 border border-[#2A2A2A]" />
              <span className="ml-3 font-mono text-xs sm:text-sm text-zinc-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#2563EB]" /> flowdesk.app/workspace/rivera-studio
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs uppercase font-mono px-3 py-1 rounded-full bg-[#181818] text-zinc-200 border border-[#2A2A2A] font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Live Workspace
              </span>
            </div>
          </div>

          {/* Inner Grid Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left relative z-10">
            {/* Stat Card 1 */}
            <div className="p-5 rounded-xl bg-[#111111]/80 border border-[#2A2A2A] backdrop-blur-md hover:border-[#2563EB]/40 hover:bg-[#181818] transition-all duration-300 shadow-sm">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest font-semibold">Active Clients</span>
              <p className="text-3xl font-extrabold text-white mt-1.5">04 Accounts</p>
              <p className="text-sm text-zinc-300 mt-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#2563EB]" /> Acme Corp • Stellar Labs
              </p>
            </div>

            {/* Stat Card 2 */}
            <div className="p-5 rounded-xl bg-[#111111]/80 border border-[#2A2A2A] backdrop-blur-md hover:border-[#2563EB]/40 hover:bg-[#181818] transition-all duration-300 shadow-sm">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest font-semibold">Deliverables For Review</span>
              <p className="text-3xl font-extrabold text-white mt-1.5">03 Awaiting Sign-off</p>
              <p className="text-sm text-zinc-300 mt-1.5 truncate">Brand Identity v2 • Web Platform</p>
            </div>

            {/* Stat Card 3 */}
            <div className="p-5 rounded-xl bg-[#111111]/80 border border-[#2A2A2A] backdrop-blur-md hover:border-[#2563EB]/40 hover:bg-[#181818] transition-all duration-300 shadow-sm">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest font-semibold">Tracked Settlements</span>
              <p className="text-3xl font-extrabold text-white mt-1.5">₹1,84,500</p>
              <p className="text-sm text-zinc-300 mt-1.5">INV-2026-0042 • Due in 5 days</p>
            </div>
          </div>
        </div>
      </motion.div>
      </div>
    </GlowCursor>
  </section>
  );
};
