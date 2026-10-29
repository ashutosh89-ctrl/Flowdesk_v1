'use client';

import React, { useState, useEffect } from 'react';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Receipt,
  Activity,
  Settings,
  Layers,
  FileSearch,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export type NavItemKey =
  | 'dashboard'
  | 'clients'
  | 'projects'
  | 'deliverables'
  | 'invoices'
  | 'documents'
  | 'activity'
  | 'settings';

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
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('flowdesk_sidebar_collapsed');
      if (stored !== null) {
        setIsCollapsed(stored === 'true');
      }
    } catch {
      // Local storage may not be accessible in all environments
    }
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('flowdesk_sidebar_collapsed', String(next));
      } catch {
        // Safe fallback
      }
      return next;
    });
  };

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

  const renderContent = (collapsedMode: boolean) => (
    <aside
      className={`h-full bg-[#101312] border-r border-[#176B5B]/30 backdrop-blur-2xl flex flex-col justify-between p-3.5 z-40 select-none transition-all duration-200 ${
        collapsedMode ? 'w-20' : 'w-64'
      } ${className}`}
    >
      <div>
        {/* Logo Branding */}
        <div
          className={`flex items-center pb-4 mb-4 border-b border-[#176B5B]/25 ${
            collapsedMode ? 'justify-center' : 'justify-between px-2'
          }`}
        >
          <div
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
            title="FlowDesk Home"
          >
            {collapsedMode ? (
              <FlowDeskLogo variant="symbol" size={28} priority />
            ) : (
              <FlowDeskLogo variant="full" size={26} priority />
            )}
          </div>
          {!collapsedMode && (
            <span className="text-[10px] text-[#A6B4AE] font-mono uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-[#176B5B]/15 border border-[#176B5B]/35">
              OS
            </span>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5" role="navigation" aria-label="Main Navigation">
          {navItems.map((item) => {
            const isActive = currentView === item.key;
            return (
              <button
                key={item.key}
                type="button"
                title={collapsedMode ? item.label : undefined}
                onClick={() => {
                  onNavigate(item.key as NavItemKey);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center rounded-xl text-[14px] font-medium transition-all duration-180 relative group text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#43D6B0]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101312] ${
                  collapsedMode ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-[#176B5B]/20 text-[#F5F5F0] shadow-[0_2px_12px_rgba(23,107,91,0.25)] border border-[#176B5B]/50'
                    : 'text-[#A6B4AE] hover:text-[#F5F5F0] hover:bg-[#191F1D] border border-transparent hover:border-[#176B5B]/30'
                }`}
              >
                {/* Active Indicator Bar on the left */}
                {isActive && (
                  <span className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-[#43D6B0] shadow-[0_0_8px_rgba(67,214,176,0.8)]" />
                )}

                {/* Live Icon Container */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-180 ${
                    isActive
                      ? 'bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/60 shadow-[0_0_10px_rgba(67,214,176,0.2)]'
                      : 'bg-transparent text-[#A6B4AE] border border-transparent group-hover:bg-[#176B5B]/15 group-hover:text-[#43D6B0] group-hover:border-[#176B5B]/30'
                  }`}
                >
                  <span className="transition-transform duration-180 group-hover:scale-110 motion-reduce:transform-none">
                    {item.icon}
                  </span>
                </div>

                {!collapsedMode && (
                  <>
                    <span className="transition-transform duration-180 group-hover:translate-x-0.5 motion-reduce:transform-none truncate font-medium">
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#43D6B0] shadow-[0_0_6px_rgba(67,214,176,0.8)]" />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Rail Collapse Toggle (Desktop only) */}
      <div className="pt-3 border-t border-[#176B5B]/20 hidden md:flex items-center justify-center">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsedMode ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-[#A6B4AE] hover:text-[#F5F5F0] hover:bg-[#191F1D] border border-transparent hover:border-[#176B5B]/30 transition-all text-xs font-medium"
        >
          {collapsedMode ? (
            <ChevronRight className="w-4 h-4 text-[#43D6B0]" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 text-[#A6B4AE]" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-screen sticky top-0 shrink-0">
        {renderContent(isCollapsed)}
      </div>

      {/* Mobile Drawer Sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <div className="relative w-64 h-full z-10">{renderContent(false)}</div>
        </div>
      )}
    </>
  );
};
