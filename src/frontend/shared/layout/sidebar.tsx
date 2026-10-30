'use client';

import React, { useState, useEffect } from 'react';
import { FlowDeskLogo } from '@/frontend/shared/branding/flowdesk-logo';
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  NavDashboardIcon,
  NavClientsIcon,
  NavProjectsIcon,
  NavDeliverablesIcon,
  NavInvoicesIcon,
  NavDocumentsIcon,
  NavActivityIcon,
  NavSettingsIcon,
} from './nav-icons';

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
    { key: 'dashboard', label: 'Dashboard', icon: <NavDashboardIcon className="w-4 h-4" /> },
    { key: 'clients', label: 'Clients', icon: <NavClientsIcon className="w-4 h-4" /> },
    { key: 'projects', label: 'Projects', icon: <NavProjectsIcon className="w-4 h-4" /> },
    { key: 'deliverables', label: 'Deliverables', icon: <NavDeliverablesIcon className="w-4 h-4" /> },
    { key: 'invoices', label: 'Invoices', icon: <NavInvoicesIcon className="w-4 h-4" /> },
    { key: 'documents', label: 'Documents', icon: <NavDocumentsIcon className="w-4 h-4" /> },
    { key: 'activity', label: 'Activity', icon: <NavActivityIcon className="w-4 h-4" /> },
    { key: 'settings', label: 'Settings', icon: <NavSettingsIcon className="w-4 h-4" /> },
  ];

  const renderContent = (collapsedMode: boolean) => (
    <aside
      className={`h-full bg-[#0D0E11] border-r border-white/10 flex flex-col justify-between z-40 select-none transition-all duration-200 ${
        collapsedMode ? 'w-20' : 'w-64'
      } ${className}`}
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* Logo Branding - EXACTLY h-16 to perfectly align with TopNav horizontal border-b */}
        <div
          className={`h-16 flex items-center border-b border-white/10 shrink-0 ${
            collapsedMode ? 'justify-center px-2' : 'justify-between px-5'
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
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5 p-3 flex-1 overflow-y-auto" role="navigation" aria-label="Main Navigation">
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
                className={`w-full flex items-center rounded-xl text-[14px] font-medium transition-all duration-180 relative group text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#43D6B0]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D0E11] ${
                  collapsedMode ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-[#181A1F] text-white shadow-sm border border-white/15'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5'
                }`}
              >
                {/* Active Indicator Bar on the left - ONLY shown when collapsed */}
                {isActive && collapsedMode && (
                  <span className="absolute left-1 top-2.5 bottom-2.5 w-1 rounded-full bg-[#43D6B0]" />
                )}

                {/* Bespoke Icon Container - Clean, without ellipse-like highlighting */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-180 ${
                    isActive
                      ? 'text-white'
                      : 'text-zinc-400 group-hover:text-white'
                  }`}
                >
                  <span className="transition-transform duration-180 group-hover:scale-110 motion-reduce:transform-none">
                    {item.icon}
                  </span>
                </div>

                {!collapsedMode && (
                  <span className="transition-transform duration-180 group-hover:translate-x-0.5 motion-reduce:transform-none truncate font-medium">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Rail Collapse Toggle (Desktop only) */}
      <div className="p-3 border-t border-white/10 hidden md:flex items-center justify-center shrink-0">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsedMode ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all text-xs font-medium cursor-pointer"
        >
          {collapsedMode ? (
            <ChevronRight className="w-4 h-4 text-[#43D6B0]" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 text-zinc-400" />
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
      <div className="hidden md:block h-full shrink-0">
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
