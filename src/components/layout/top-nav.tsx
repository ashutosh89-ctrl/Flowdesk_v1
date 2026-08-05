import React from 'react';
import { Menu, Search, Plus, Settings } from 'lucide-react';
import { BreadcrumbItem } from '../ui/breadcrumbs';
import { Button } from '../ui/button';
import { NotificationMenu } from '../common/notification-menu';
import { UserProfileMenu } from '../common/user-profile-menu';
import { UserProfile } from '../../types';

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
    <header className="w-full h-16 px-4 md:px-8 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left Section: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 text-zinc-400 hover:text-white md:hidden rounded-lg hover:bg-white/10 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-white tracking-tight">{currentTitle}</h2>
          <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </div>
      </div>

      {/* Center Section: Modern OS ⌘K Glass Search Bar */}
      <div className="flex-1 max-w-[540px] mx-4 hidden md:block">
        <button
          onClick={onOpenSearch}
          className="w-full h-9 px-3.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.07] backdrop-blur-md flex items-center justify-between text-xs text-zinc-400 hover:text-white transition-all duration-200 shadow-inner group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-colors" />
            <span className="font-normal text-zinc-400 group-hover:text-zinc-300">
              Search clients, invoices, deliverables, documents...
            </span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-white/10 border border-white/15 rounded text-zinc-300 shadow-sm">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Section: Actions, Notifications, Settings, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Search Icon Button */}
        <button
          onClick={onOpenSearch}
          className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Quick Action Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={onQuickAction || onOpenSearch}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          className="text-xs font-semibold shadow-md"
        >
          <span className="hidden sm:inline">New</span>
        </Button>

        {/* Settings Shortcut Button */}
        <button
          onClick={() => onNavigate('settings')}
          className="p-2 text-zinc-400 hover:text-white rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.08] transition-all"
          title="Settings"
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

