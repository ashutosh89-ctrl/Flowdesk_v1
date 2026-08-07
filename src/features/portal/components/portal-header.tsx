'use client';

import React from 'react';
import { Search, Bell, Menu, Sparkles, Plus, Eye, Lock, ShieldCheck } from 'lucide-react';
import { PortalNotification } from '../../../types';

interface PortalHeaderProps {
  companyName: string;
  clientName: string;
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
    <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Tab Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider">
                {companyName}
              </span>
              <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-zinc-600" />
              <span className="hidden sm:inline-block text-xs text-zinc-400 font-medium">Prepared by Rivera Studio</span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">{activeTabTitle}</h1>
          </div>
        </div>

        {/* Center: Search input */}
        <div className="hidden md:flex items-center flex-1 max-w-xs relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search deliverables, docs, invoices..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-zinc-900/90 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 text-[10px] text-zinc-400 hover:text-white font-mono bg-white/10 px-1.5 py-0.5 rounded"
            >
              Clear
            </button>
          )}
        </div>

        {/* Right: Actions, Notifications, Security Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Actions Button */}
          <button
            onClick={onOpenQuickActions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-bold text-xs shadow-md shadow-white/5 transition-all active:scale-95"
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
                  ? 'bg-white/15 border-white/30 text-white'
                  : 'bg-white/5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/10'
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
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Secure Magic Link</span>
          </div>
        </div>
      </div>
    </header>
  );
};
