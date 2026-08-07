import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '../../components/ui/button';
import { ArrowRight, CheckCircle2, Terminal } from 'lucide-react';
import { MonochromeFluidCanvas } from './monochrome-fluid-canvas';

export interface HeroProps {
  onLaunchApp: () => void;
  onOpenAuth: (view: 'signup') => void;
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
      className="relative pt-32 pb-28 px-6 lg:px-12 overflow-hidden flex flex-col items-center text-center select-none min-h-[90vh]"
    >
      {/* Living Monochrome Fluid Canvas Layer */}
      <MonochromeFluidCanvas />

      {/* Subtle Premium Badge */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-950/80 border border-white/20 backdrop-blur-2xl text-xs font-medium text-zinc-200 mb-8 shadow-[0_8px_32px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.25)]"
      >
        <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,1)] animate-pulse" />
        <span className="tracking-wide">Operating System for Freelancers</span>
      </motion.div>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white max-w-4xl leading-[1.08]"
      >
        The Freelancer Operating System
        <span className="block text-zinc-400 font-normal mt-3 text-3xl sm:text-5xl lg:text-6xl tracking-tight">
          Quietly organized business.
        </span>
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="text-base sm:text-lg text-zinc-300 max-w-2xl mt-6 leading-relaxed font-normal"
      >
        FlowDesk replaces fragmented spreadsheets, messaging threads, lost invoices, and scattered Google Drive folders with a single, crystal-glass operating surface.
      </motion.p>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-center justify-center gap-4 mt-9 z-20"
      >
        <Button
          variant="primary"
          size="lg"
          onClick={onLaunchApp}
          className="shadow-[0_0_24px_rgba(255,255,255,0.2)] hover:shadow-[0_0_40px_rgba(255,255,255,0.35)] transition-all duration-300"
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          Launch Workspace OS
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => onOpenAuth('signup')}
          className="hover:border-white/40 transition-all duration-300"
        >
          Get Started Free
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
        <div className="relative rounded-2xl border border-white/20 bg-zinc-950/85 backdrop-blur-3xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.95),inset_0_1px_0_0_rgba(255,255,255,0.25)] p-5 sm:p-7 overflow-hidden group hover:border-white/35 transition-all duration-500">
          {/* Glass Cursor Reflection Highlight */}
          {isHovered && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle 350px at ${mousePos.px}px ${mousePos.py}px, rgba(255, 255, 255, 0.08), transparent 70%)`,
              }}
            />
          )}

          {/* Mock Window Top Bar */}
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10 text-xs text-zinc-400 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-zinc-700/80 border border-white/10" />
              <div className="w-3 h-3 rounded-full bg-zinc-700/80 border border-white/10" />
              <div className="w-3 h-3 rounded-full bg-zinc-700/80 border border-white/10" />
              <span className="ml-3 font-mono text-[11px] text-zinc-400 flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-zinc-400" /> flowdesk.app/workspace/apex-labs
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase font-mono px-2.5 py-1 rounded-full bg-white/10 text-zinc-200 border border-white/15">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live OS Core
              </span>
            </div>
          </div>

          {/* Inner Grid Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left relative z-10">
            {/* Stat Card 1 */}
            <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md hover:border-white/30 hover:bg-white/[0.08] transition-all duration-300 shadow-sm">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-semibold">Active Pipeline</span>
              <p className="text-2xl font-bold text-white mt-1">$48,500.00</p>
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" /> 3 Enterprise Accounts
              </p>
            </div>

            {/* Stat Card 2 */}
            <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md hover:border-white/30 hover:bg-white/[0.08] transition-all duration-300 shadow-sm">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-semibold">Pending Approvals</span>
              <p className="text-2xl font-bold text-white mt-1">2 Deliverables</p>
              <p className="text-xs text-zinc-400 mt-1 truncate">Design Tokens v1.4 • Waveform UI</p>
            </div>

            {/* Stat Card 3 */}
            <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-md hover:border-white/30 hover:bg-white/[0.08] transition-all duration-300 shadow-sm">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-semibold">Workspace Health</span>
              <p className="text-2xl font-bold text-white mt-1">98 / 100</p>
              <p className="text-xs text-zinc-400 mt-1">Zero pending client blockers</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
