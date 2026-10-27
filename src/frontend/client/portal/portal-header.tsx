'use client';

import React from 'react';
import { Search, Bell, Menu, Sparkles, Plus, Eye, Lock, ShieldCheck } from 'lucide-react';
import { PortalNotification } from '@/shared/types';
import { ClientWorkspaceSwitcher } from './client-workspace-switcher';
import { isSafeImageUrl } from '@/shared/utils/safe-url';

interface PortalHeaderProps {
  companyName: string;
  clientName: string;
  logoUrl?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  notifications: PortalNotification[];
  isNotificationsOpen: boolean;
  onToggleNotifications: () => void;
  onOpenQuickActions: () => void;
  onOpenMobileSidebar: () => void;
  activeTabTitle: string;
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({
  companyName,
  clientName,
  logoUrl,
  searchQuery,
  onSearchChange,
  notifications,
  isNotificationsOpen,
  onToggleNotifications,
  onOpenQuickActions,
  onOpenMobileSidebar,
  activeTabTitle,
}) => {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-20 bg-[#101312]/95 backdrop-blur-xl border-b border-[#176B5B]/25 px-4 sm:px-6 py-3.5 transition-all select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Tab Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-xl bg-[#191F1D] border border-[#176B5B]/30 text-[#A6B4AE] hover:text-[#F5F5F0] hover:border-[#43D6B0]/50 transition-colors"
            title="Open navigation menu"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              {logoUrl && isSafeImageUrl(logoUrl) ? (
                <img src={logoUrl} alt="" className="w-4 h-4 object-contain rounded" />
              ) : (
                <img src="/branding/flowdesk-symbol.png" alt="" className="w-4 h-4 object-contain opacity-80" />
              )}
              <span className="text-xs font-mono uppercase text-[#A6B4AE] font-semibold tracking-wider">
                {companyName}
              </span>
              <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-[#176B5B]" />
              <span className="hidden sm:inline-block text-xs text-[#A6B4AE] font-medium">Client Portal</span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-[#F5F5F0] tracking-tight">{activeTabTitle}</h1>
          </div>
        </div>

        {/* Center: Search input */}
        <div className="hidden md:flex items-center flex-1 max-w-xs relative">
          <Search className="w-3.5 h-3.5 text-[#A6B4AE] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search deliverables, docs, invoices..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#191F1D] border border-[#176B5B]/30 text-xs text-[#F5F5F0] placeholder-[#A6B4AE]/60 focus:outline-none focus:border-[#43D6B0] focus:ring-1 focus:ring-[#43D6B0]/40 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 text-[10px] text-[#A6B4AE] hover:text-[#F5F5F0] font-mono bg-[#176B5B]/20 px-1.5 py-0.5 rounded"
            >
              Clear
            </button>
          )}
        </div>

        {/* Right: Workspace Switcher, Actions, Notifications, Security Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Workspace Switcher */}
          <ClientWorkspaceSwitcher />

          {/* Quick Actions Button */}
          <button
            onClick={onOpenQuickActions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#43D6B0] hover:bg-[#43D6B0]/90 text-[#101312] font-bold text-xs shadow-md shadow-[#43D6B0]/20 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Quick Action</span>
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={onToggleNotifications}
              className={`relative p-2 rounded-xl border transition-all ${
                isNotificationsOpen
                  ? 'bg-[#176B5B]/20 border-[#176B5B]/50 text-[#43D6B0]'
                  : 'bg-[#191F1D] border-[#176B5B]/30 text-[#A6B4AE] hover:text-[#F5F5F0] hover:border-[#43D6B0]/40'
              }`}
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-zinc-950 font-extrabold text-[9px] flex items-center justify-center border border-zinc-950 shadow-sm animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Security Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#176B5B]/15 border border-[#176B5B]/35 text-[#43D6B0] text-[11px] font-mono">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Secure Magic Link</span>
          </div>
        </div>
      </div>
    </header>
  );
};
