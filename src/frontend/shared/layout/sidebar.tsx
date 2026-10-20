import React from 'react';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Receipt,
  Activity,
  Settings,
  Sparkles,
  Layers,
  FileSearch,
} from 'lucide-react';

export type NavItemKey = 'dashboard' | 'clients' | 'projects' | 'deliverables' | 'invoices' | 'documents' | 'activity' | 'settings';

export interface SidebarProps {
  currentView: NavItemKey | string;
  onNavigate: (view: NavItemKey) => void;
  className?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  className = '',
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: 'clients', label: 'Clients', icon: <Users className="w-4 h-4" /> },
    { key: 'projects', label: 'Projects', icon: <FolderKanban className="w-4 h-4" /> },
    { key: 'deliverables', label: 'Deliverables', icon: <Layers className="w-4 h-4" /> },
    { key: 'invoices', label: 'Invoices', icon: <Receipt className="w-4 h-4" /> },
    { key: 'documents', label: 'Documents', icon: <FileSearch className="w-4 h-4" /> },
    { key: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
    { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const content = (
    <aside
      className={`w-64 h-full bg-[#0A0A0A]/95 border-r border-[#2A2A2A] backdrop-blur-2xl flex flex-col justify-between p-4 z-40 select-none ${className}`}
    >
      <div>
        {/* Logo Branding */}
        <div className="flex items-center justify-between px-3 py-4 mb-6 border-b border-[#2A2A2A]">
          <FlowDeskLogo variant="full" size={26} priority />
          <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider font-semibold">
            OS
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5" role="navigation" aria-label="Main Navigation">
          {navItems.map((item) => {
            const isActive = currentView === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onNavigate(item.key as NavItemKey);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-[14px] sm:text-[15px] font-semibold transition-all duration-200 relative group text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] ${
                  isActive
                    ? 'bg-[#0047AB]/20 text-white shadow-[inset_0_1px_0_0_rgba(37,99,235,0.35),0_4px_16px_rgba(0,71,171,0.2)] border border-[#2563EB]/45'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/5'
                }`}
              >
                {/* Active Indicator Bar on the left */}
                {isActive && (
                  <span className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-[#2563EB] shadow-[0_0_8px_rgba(37,99,235,0.9)]" />
                )}

                <span
                  className={`transition-all duration-200 transform group-hover:scale-110 motion-reduce:transform-none ${
                    isActive ? 'text-[#3B82F6]' : 'text-zinc-400 group-hover:text-zinc-100'
                  }`}
                >
                  {item.icon}
                </span>

                <span className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transform-none">
                  {item.label}
                </span>

                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#2563EB] shadow-[0_0_8px_rgba(37,99,235,0.9)]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / System Status */}
      <div className="p-3.5 rounded-xl bg-[#111111] border border-[#2A2A2A] backdrop-blur-md">
        <div className="flex items-center justify-between text-sm text-zinc-300">
          <span className="flex items-center gap-2 font-semibold text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            System Live
          </span>
          <span className="text-xs text-zinc-400 font-mono font-medium">v1.0.0</span>
        </div>
        <p className="text-xs text-zinc-400 mt-1 font-medium">Freelancer Operating System</p>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-screen sticky top-0 shrink-0">{content}</div>

      {/* Mobile Drawer Sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <div className="relative w-64 h-full z-10">{content}</div>
        </div>
      )}
    </>
  );
};
