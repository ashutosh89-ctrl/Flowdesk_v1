import React, { useState } from 'react';
import { Sidebar, NavItemKey } from './sidebar';
import { TopNav } from './top-nav';
import { CommandPalette } from '../ui/command-palette';
import { ToastProvider } from '../ui/toast';
import { UserProfile } from '../../types';

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

  const getBreadcrumbs = () => {
    const capitalized = currentView.charAt(0).toUpperCase() + currentView.slice(1);
    const items = [
      { label: 'FlowDesk', onClick: () => onNavigate('dashboard') },
      { label: breadcrumbLabel || capitalized, active: true },
    ];
    return items;
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col md:flex-row selection:bg-white selection:text-zinc-950 font-sans">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={(v) => onNavigate(v)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <TopNav
          breadcrumbItems={getBreadcrumbs()}
          userProfile={userProfile}
          onOpenSearch={() => setIsCommandPaletteOpen(true)}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onNavigate={onNavigate}
          onSwitchViewMode={onSwitchViewMode}
          onQuickAction={onQuickAction}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </main>
      </div>

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
