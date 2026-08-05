import React from 'react';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Receipt,
  Activity,
  Settings,
  Sparkles,
  Layers,
} from 'lucide-react';

export type NavItemKey = 'dashboard' | 'clients' | 'projects' | 'invoices' | 'activity' | 'settings';

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
    { key: 'invoices', label: 'Invoices', icon: <Receipt className="w-4 h-4" /> },
    { key: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
    { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const content = (
    <aside
      className={`w-64 h-full bg-zinc-950/90 border-r border-white/10 backdrop-blur-2xl flex flex-col justify-between p-4 z-40 select-none ${className}`}
    >
      <div>
        {/* Logo Branding */}
        <div className="flex items-center gap-3 px-3 py-4 mb-6 border-b border-white/10">
          <div className="w-8 h-8 rounded-xl bg-white text-zinc-950 flex items-center justify-center font-bold text-lg shadow-[0_0_20px_rgba(255,255,255,0.4)]">
            F
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              FlowDesk
            </span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold">
              Freelancer OS
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentView === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  onNavigate(item.key as NavItemKey);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group ${
                  isActive
                    ? 'bg-white/10 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] border border-white/15'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <span
                  className={`transition-colors ${
                    isActive ? 'text-white' : 'text-zinc-400 group-hover:text-white'
                  }`}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / System Status */}
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5 font-medium text-white">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            System Live
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">v1.0.0</span>
        </div>
        <p className="text-[10px] text-zinc-500 mt-1">FlowDesk Phase 1 Shell</p>
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
