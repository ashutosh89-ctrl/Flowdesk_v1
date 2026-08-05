import React from 'react';
import { Button } from '../../components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';

export interface LandingNavProps {
  onOpenAuth: (view: 'login' | 'signup') => void;
  onLaunchApp: () => void;
}

export const LandingNav: React.FC<LandingNavProps> = ({ onOpenAuth, onLaunchApp }) => {
  return (
    <header className="w-full h-20 px-6 lg:px-12 fixed top-0 left-0 right-0 z-50 bg-zinc-950/70 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 cursor-pointer" onClick={onLaunchApp}>
        <div className="w-9 h-9 rounded-xl bg-white text-zinc-950 flex items-center justify-center font-bold text-xl shadow-[0_0_24px_rgba(255,255,255,0.4)]">
          F
        </div>
        <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
          FlowDesk
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/15">
            v1.0
          </span>
        </span>
      </div>

      {/* Nav Links */}
      <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-zinc-400">
        <a href="#features" className="hover:text-white transition-colors">Features</a>
        <a href="#workflow" className="hover:text-white transition-colors">Workflow</a>
        <a href="#benefits" className="hover:text-white transition-colors">Benefits</a>
        <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
      </nav>

      {/* Auth & CTA Actions */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => onOpenAuth('login')}>
          Sign In
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onLaunchApp}
          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
        >
          Launch OS
        </Button>
      </div>
    </header>
  );
};
