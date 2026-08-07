import React from 'react';
import { Button } from '../../components/ui/button';
import { ArrowRight } from 'lucide-react';

export interface LandingNavProps {
  onOpenAuth: (view: 'login' | 'signup') => void;
  onLaunchApp: () => void;
}

export const LandingNav: React.FC<LandingNavProps> = ({ onOpenAuth, onLaunchApp }) => {
  const navItems = [
    { label: 'Features', href: '#features' },
    { label: 'Workflow', href: '#workflow' },
    { label: 'Benefits', href: '#benefits' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="w-full h-20 px-6 lg:px-12 fixed top-0 left-0 right-0 z-50 bg-zinc-950/75 backdrop-blur-3xl border-b border-white/10 flex items-center justify-between shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 cursor-pointer group" onClick={onLaunchApp}>
        <div className="w-9 h-9 rounded-xl bg-white text-zinc-950 flex items-center justify-center font-bold text-xl shadow-[0_0_24px_rgba(255,255,255,0.4)] group-hover:scale-105 transition-transform duration-300">
          F
        </div>
        <span className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
          FlowDesk
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/15">
            v1.0
          </span>
        </span>
      </div>

      {/* Nav Links with Illumination Underline Micro-Motion */}
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
