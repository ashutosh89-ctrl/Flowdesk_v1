import React, { useState, useEffect } from 'react';
import { Sidebar, NavItemKey } from './sidebar';
import { TopNav } from './top-nav';
import { CommandPalette } from '../ui/command-palette';
import { ToastProvider } from '../ui/toast';
import { UserProfile } from '@/shared/types';
import {
  LayoutDashboard,
  FolderKanban,
  PackageCheck,
  Receipt,
  Menu,
} from 'lucide-react';

export interface AppShellProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onSwitchViewMode: (mode: 'app' | 'landing') => void;
  userProfile: UserProfile;
  children: React.ReactNode;
  onQuickAction?: () => void;
  breadcrumbLabel?: string;
}

export const AppShellContent: React.FC<AppShellProps> = ({
  currentView,
  onNavigate,
  onSwitchViewMode,
  userProfile,
  children,
  onQuickAction,
  breadcrumbLabel,
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Global keyboard shortcut: Ctrl+K / Cmd+K to toggle Search / Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Ensure window scroll position is reset on enter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, []);

  const getBreadcrumbs = () => {
    const capitalized = currentView.charAt(0).toUpperCase() + currentView.slice(1);
    const items = [
      { label: 'FlowDesk', onClick: () => onNavigate('dashboard') },
      { label: breadcrumbLabel || capitalized, active: true },
    ];
    return items;
  };

  const mobileNavItems = [
    { key: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { key: 'projects', label: 'Projects', icon: FolderKanban },
    { key: 'deliverables', label: 'Deliverables', icon: PackageCheck },
    { key: 'invoices', label: 'Invoices', icon: Receipt },
  ];

  return (
    <div className="h-screen w-full bg-[#101312] text-[#F5F5F0] flex flex-col md:flex-row overflow-hidden selection:bg-[#43D6B0] selection:text-[#101312] font-sans">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={(v) => onNavigate(v)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto overflow-x-hidden">
        <TopNav
          breadcrumbItems={getBreadcrumbs()}
          userProfile={userProfile}
          onOpenSearch={() => setIsCommandPaletteOpen(true)}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onNavigate={onNavigate}
          onSwitchViewMode={onSwitchViewMode}
          onQuickAction={onQuickAction}
        />

        <main className="flex-1 p-3.5 sm:p-6 md:p-8 pb-32 md:pb-8 max-w-7xl w-full mx-auto space-y-6 sm:space-y-8">
          {children}
        </main>
      </div>

      {/* Mobile Phone Bottom Navigation Dock */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0D0E11]/95 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.5)] select-none"
      >
        {mobileNavItems.map((item) => {
          const isActive = currentView === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-w-[56px] ${
                isActive
                  ? 'text-[#43D6B0]'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#43D6B0]" />
                )}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${isActive ? 'font-bold text-white' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* More button to toggle drawer */}
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer min-w-[56px]"
          aria-label="More navigation options"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-medium">Menu</span>
        </button>
      </nav>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(v) => onNavigate(v)}
      />
    </div>
  );
};

export const AppShell: React.FC<AppShellProps> = (props) => (
  <ToastProvider>
    <AppShellContent {...props} />
  </ToastProvider>
);
