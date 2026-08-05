import React from 'react';
import { ArrowUpRight, Github, Twitter, Linkedin, ShieldCheck, Terminal } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="w-full bg-zinc-950 border-t border-white/10 pt-20 pb-12 px-6 lg:px-12 text-zinc-400 select-none relative overflow-hidden">
      {/* Background Soft Beam */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
        {/* Brand Overview Column */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white text-zinc-950 flex items-center justify-center font-bold text-lg shadow-[0_0_20px_rgba(255,255,255,0.4)]">
              F
            </div>
            <span className="text-lg font-bold tracking-tight text-white">FlowDesk</span>
          </div>
          <p className="text-xs text-zinc-400 max-w-sm leading-relaxed font-normal">
            FlowDesk is built to simplify freelance operations through one unified operating system. Crafted with crystal-glass precision and relentless monochrome polish.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              All Systems Operational
            </span>
          </div>
        </div>

        {/* Product Column */}
        <div>
          <h5 className="text-[11px] font-mono font-semibold text-white uppercase tracking-widest mb-4">Product</h5>
          <ul className="space-y-2.5 text-xs">
            <li><a href="#features" className="hover:text-white transition-colors">Client Workspaces</a></li>
            <li><a href="#features" className="hover:text-white transition-colors">Deliverable Engine</a></li>
            <li><a href="#features" className="hover:text-white transition-colors">Instant Invoicing</a></li>
            <li><a href="#features" className="hover:text-white transition-colors">Client Magic Portals</a></li>
            <li><a href="#features" className="hover:text-white transition-colors">Document Repository</a></li>
            <li><a href="#features" className="hover:text-white transition-colors">Command Search (⌘K)</a></li>
          </ul>
        </div>

        {/* Resources Column */}
        <div>
          <h5 className="text-[11px] font-mono font-semibold text-white uppercase tracking-widest mb-4">Resources</h5>
          <ul className="space-y-2.5 text-xs">
            <li><a href="#workflow" className="hover:text-white transition-colors">Freelancer Playbook</a></li>
            <li><a href="#pricing" className="hover:text-white transition-colors">Rate Calculator</a></li>
            <li><a href="#faq" className="hover:text-white transition-colors">Documentation</a></li>
            <li><a href="#faq" className="hover:text-white transition-colors">Status Page</a></li>
            <li><a href="#faq" className="hover:text-white transition-colors">Changelog</a></li>
            <li><a href="#faq" className="hover:text-white transition-colors">Public Roadmap</a></li>
          </ul>
        </div>

        {/* Company & Legal Column */}
        <div>
          <h5 className="text-[11px] font-mono font-semibold text-white uppercase tracking-widest mb-4">Company</h5>
          <ul className="space-y-2.5 text-xs">
            <li><a href="#manifesto" className="hover:text-white transition-colors">Manifesto</a></li>
            <li><a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
            <li><a href="#terms" className="hover:text-white transition-colors">Terms of Service</a></li>
            <li><a href="#support" className="hover:text-white transition-colors">Support & Contact</a></li>
            <li><a href="#security" className="hover:text-white transition-colors">Security Overview</a></li>
          </ul>
        </div>
      </div>

      {/* Bottom Legal & Copyright Bar */}
      <div className="max-w-7xl mx-auto pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <p>© 2026 FlowDesk Technologies. Designed for modern independent businesses. All rights reserved.</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-white transition-colors"><Twitter className="w-4 h-4" /></a>
          <a href="#" className="hover:text-white transition-colors"><Github className="w-4 h-4" /></a>
          <a href="#" className="hover:text-white transition-colors"><Linkedin className="w-4 h-4" /></a>
        </div>
      </div>
    </footer>
  );
};

