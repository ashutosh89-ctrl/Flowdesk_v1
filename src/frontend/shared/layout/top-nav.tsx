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
    <header className="w-full h-16 px-4 md:px-8 border-b border-[#176B5B]/25 bg-[#101312]/95 backdrop-blur-xl flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left Section: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="p-2 text-[#A6B4AE] hover:text-[#F5F5F0] md:hidden rounded-lg hover:bg-[#176B5B]/20 transition-colors"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <h2 className="text-base sm:text-lg font-bold font-display text-[#F5F5F0] tracking-tight">{currentTitle}</h2>
          <span className="hidden sm:inline-block w-2 h-2 rounded-full bg-[#43D6B0]" />
        </div>
      </div>

      {/* Center Section: Modern OS ⌘K Search Bar */}
      <div className="flex-1 max-w-[540px] mx-4 hidden md:block">
        <button
          onClick={onOpenSearch}
          className="w-full h-10 px-4 rounded-xl bg-[#191F1D] border border-[#176B5B]/30 hover:border-[#43D6B0]/50 hover:bg-[#191F1D]/80 backdrop-blur-md flex items-center justify-between text-sm text-[#A6B4AE] hover:text-[#F5F5F0] transition-all duration-200 group"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-[#A6B4AE] group-hover:text-[#43D6B0] transition-colors" />
            <span className="font-medium text-[#A6B4AE] group-hover:text-[#F5F5F0]">
              Search clients, invoices, deliverables, documents...
            </span>
          </div>
          <kbd className="px-2 py-0.5 text-xs font-mono font-medium bg-[#101312] border border-[#176B5B]/30 rounded text-[#A6B4AE] shadow-sm">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Section: Actions, Notifications, Settings, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Search Icon Button */}
        <button
          onClick={onOpenSearch}
          className="md:hidden p-2 text-[#A6B4AE] hover:text-[#F5F5F0] rounded-lg hover:bg-[#176B5B]/20 transition-colors"
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
          className="text-xs font-semibold shadow-md"
          aria-label="Open quick actions"
        >
          <span className="hidden sm:inline">New</span>
        </Button>

        {/* Settings Shortcut Button */}
        <button
          onClick={() => onNavigate('settings')}
          className="p-2 text-[#A6B4AE] hover:text-[#F5F5F0] rounded-xl bg-[#191F1D] border border-[#176B5B]/30 hover:border-[#43D6B0]/50 hover:bg-[#176B5B]/20 transition-all"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Notifications Popover */}
        <NotificationMenu />

        <div className="h-4 w-px bg-[#176B5B]/30 mx-1 hidden sm:block" />

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

