import React from 'react';
import { Menu, Search, Plus, Settings } from 'lucide-react';
import { BreadcrumbItem } from '../ui/breadcrumbs';
import { Button } from '../ui/button';
import { NotificationMenu } from '../common/notification-menu';
import { UserProfileMenu } from '../common/user-profile-menu';
import { UserProfile } from '@/shared/types';

export interface TopNavProps {
  breadcrumbItems: BreadcrumbItem[];
  userProfile: UserProfile;
  onOpenSearch: () => void;
  onOpenMobileSidebar: () => void;
  onNavigate: (view: string) => void;
  onSwitchViewMode: (mode: 'app' | 'landing') => void;
  onQuickAction?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  breadcrumbItems,
  userProfile,
  onOpenSearch,
  onOpenMobileSidebar,
  onNavigate,
  onSwitchViewMode,
  onQuickAction,
}) => {
  const currentTitle = breadcrumbItems[breadcrumbItems.length - 1]?.label || 'Dashboard';

  return (
    <header className="w-full h-16 px-4 md:px-8 border-b border-white/10 bg-[#0D0E11] flex items-center justify-between sticky top-0 z-30 select-none shrink-0">
      {/* Left Section: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 text-zinc-400 hover:text-white md:hidden rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <h2 className="text-base sm:text-lg font-bold font-display text-white tracking-tight">{currentTitle}</h2>
        </div>
      </div>

      {/* Center Section: Modern OS ⌘K Search Bar */}
      <div className="flex-1 max-w-[540px] mx-4 hidden md:block">
        <button
          onClick={onOpenSearch}
          className="w-full h-10 px-4 rounded-xl bg-[#131518] border border-white/10 hover:border-white/20 hover:bg-[#181A1F] flex items-center justify-between text-sm text-zinc-400 hover:text-white transition-all duration-200 group cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-zinc-400 group-hover:text-[#43D6B0] transition-colors" />
            <span className="font-medium text-zinc-400 group-hover:text-zinc-200">
              Search clients, invoices, deliverables, documents...
            </span>
          </div>
          <kbd className="px-2 py-0.5 text-xs font-mono font-medium bg-[#0D0E11] border border-white/10 rounded text-zinc-400 shadow-sm">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Section: Actions, Notifications, Settings, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Search Icon Button */}
        <button
          onClick={onOpenSearch}
          className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Quick Action Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            if (onQuickAction) {
              onQuickAction();
            }
          }}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          className="text-xs font-semibold shadow-sm"
          aria-label="Open quick actions"
        >
          <span className="hidden sm:inline">New</span>
        </Button>

        {/* Settings Shortcut Button */}
        <button
          onClick={() => onNavigate('settings')}
          className="p-2 text-zinc-400 hover:text-white rounded-xl bg-[#131518] border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all cursor-pointer"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Notifications Popover */}
        <NotificationMenu />

        <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

        {/* User Profile Dropdown Menu */}
        <UserProfileMenu
          profile={userProfile}
          onNavigate={onNavigate}
          onSwitchViewMode={onSwitchViewMode}
        />
      </div>
    </header>
  );
};

