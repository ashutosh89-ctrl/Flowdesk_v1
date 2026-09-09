import React, { useState, useEffect } from 'react';
import { Dropdown, DropdownItem } from '../ui/dropdown';
import { Avatar } from '../ui/avatar';
import { Settings, User, LogOut, Monitor, Building2 } from 'lucide-react';
import { UserProfile } from '@/shared/types';
import { useAuth } from '@/frontend/auth/auth-context';

export interface UserProfileMenuProps {
  profile?: UserProfile | null;
  onNavigate: (view: string) => void;
  onSwitchViewMode: (mode: 'app' | 'landing') => void;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({
  profile,
  onNavigate,
  onSwitchViewMode,
}) => {
  const { user, signOut } = useAuth();
  const [hasClientAccess, setHasClientAccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function checkRoles() {
      try {
        const res = await fetch('/api/auth/roles', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.client) {
            setHasClientAccess(true);
          }
        }
      } catch {
        // Non-critical role check
      }
    }
    checkRoles();
    return () => {
      isMounted = false;
    };
  }, []);

  const displayName = profile?.name ?? user?.email?.split('@')[0] ?? 'User';
  const displayCompany = profile?.companyName || 'My Workspace';

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('flowdesk_workspace_mode');
    }
    await signOut();
    onSwitchViewMode('landing');
  };

  const handleSwitchToClient = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('flowdesk_workspace_mode', 'client');
    }
    window.location.assign('/client/dashboard');
  };

  const items: DropdownItem[] = [
    {
      id: 'item-profile',
      label: displayName,
      icon: <User className="w-4 h-4" />,
      onClick: () => onNavigate('settings'),
    },
    ...(hasClientAccess
      ? [
          {
            id: 'item-client-portal',
            label: 'Switch to Client Portal',
            icon: <Building2 className="w-4 h-4 text-emerald-400" />,
            onClick: handleSwitchToClient,
          },
        ]
      : []),
    {
      id: 'item-settings',
      label: 'Preferences & Rates',
      icon: <Settings className="w-4 h-4" />,
      onClick: () => onNavigate('settings'),
    },
    {
      id: 'item-landing',
      label: 'View Landing Page',
      icon: <Monitor className="w-4 h-4" />,
      onClick: () => onSwitchViewMode('landing'),
    },
    {
      id: 'item-logout',
      label: 'Sign Out',
      icon: <LogOut className="w-4 h-4" />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Dropdown
      align="right"
      trigger={
        <button className="flex items-center gap-2 p-1 rounded-xl hover:bg-white/10 transition-colors group">
          <Avatar name={displayName} src={profile?.avatarUrl} size="sm" />
          <div className="hidden sm:flex flex-col text-left pr-1">
            <span className="text-xs font-semibold text-white group-hover:text-white truncate max-w-[120px]">
              {displayName}
            </span>
            <span className="text-[10px] text-zinc-400 truncate max-w-[120px]">
              {displayCompany}
            </span>
          </div>
        </button>
      }
      items={items}
    />
  );
};

