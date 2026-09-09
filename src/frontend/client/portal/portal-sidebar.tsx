'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  FileText,
  CreditCard,
  MessageSquare,
  Clock,
  User,
  ShieldCheck,
  X,
  Sparkles,
  LogOut,
  BriefcaseBusiness,
} from 'lucide-react';
import { ClientAuthService } from '@/backend/client/client-auth-service';

export type PortalTabType =
  | 'overview'
  | 'projects'
  | 'deliverables'
  | 'documents'
  | 'invoices'
  | 'comments'
  | 'activity'
  | 'profile';

interface PortalSidebarProps {
  activeTab: PortalTabType;
  onTabChange: (tab: PortalTabType) => void;
  companyName: string;
  clientName: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  unreadCommentsCount?: number;
  pendingApprovalsCount?: number;
  pendingDocumentsCount?: number;
  unpaidInvoicesCount?: number;
}

export const PortalSidebar: React.FC<PortalSidebarProps> = ({
  activeTab,
  onTabChange,
  companyName,
  clientName,
  isMobileOpen = false,
  onCloseMobile,
  unreadCommentsCount = 0,
  pendingApprovalsCount = 0,
  pendingDocumentsCount = 0,
  unpaidInvoicesCount = 0,
}) => {
  const [hasFreelancerAccess, setHasFreelancerAccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function checkRoles() {
      try {
        const res = await fetch('/api/auth/roles', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.freelancer) {
            setHasFreelancerAccess(true);
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

  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('flowdesk_workspace_mode');
      }
      await ClientAuthService.logout();
    } finally {
      window.location.href = '/login';
    }
  };

  const handleSwitchToFreelancer = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('flowdesk_workspace_mode', 'freelancer');
    }
    window.location.assign('/dashboard');
  };

  const navItems: {
    id: PortalTabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    {
      id: 'deliverables',
      label: 'Deliverables',
      icon: CheckSquare,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: FileText,
      badge: pendingDocumentsCount > 0 ? pendingDocumentsCount : undefined,
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    },
    {
      id: 'invoices',
      label: 'Invoices',
      icon: CreditCard,
      badge: unpaidInvoicesCount > 0 ? unpaidInvoicesCount : undefined,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'comments',
      label: 'Comments',
      icon: MessageSquare,
      badge: unreadCommentsCount > 0 ? unreadCommentsCount : undefined,
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    },
    { id: 'activity', label: 'Activity', icon: Clock },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const content = (
    <div className="h-full flex flex-col justify-between p-4 bg-zinc-950/95 backdrop-blur-2xl border-r border-white/10 w-64 text-white font-sans">
      <div className="space-y-6">
        {/* Brand / Client Workspace Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-white to-zinc-300 text-zinc-950 font-extrabold flex items-center justify-center text-base shadow-lg shadow-white/5 shrink-0">
              {companyName ? companyName.charAt(0) : 'C'}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white tracking-tight truncate">{companyName}</h2>
              <p className="text-[11px] text-zinc-400 truncate">Client Portal</p>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Client Welcome Tag */}
        <div className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-mono text-zinc-400 font-semibold tracking-wider">Logged in as</p>
            <p className="text-xs font-semibold text-white truncate">{clientName}</p>
          </div>
        </div>

        {/* Client Portal Main Nav */}
        <nav className="space-y-1">
          <p className="px-3 text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-semibold mb-2">
            Workspace Nav
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-white text-zinc-950 font-bold shadow-md shadow-white/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-zinc-950' : 'text-zinc-400 group-hover:text-white'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono border font-bold ${
                      isActive ? 'bg-zinc-900 text-white border-zinc-700' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Switcher & Security Footer */}
      <div className="pt-4 border-t border-white/10 space-y-2.5">
        {hasFreelancerAccess && (
          <button
            type="button"
            onClick={handleSwitchToFreelancer}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all shadow-sm"
          >
            <BriefcaseBusiness className="w-3.5 h-3.5 text-amber-400" />
            Switch to Freelancer Studio
          </button>
        )}

        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-emerald-300">Magic Access Security</p>
            <p className="text-[10px] text-zinc-400 leading-relaxed mt-0.5">
              Encrypted authenticated access provided by your service provider.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/[0.02] hover:bg-white/10 border border-white/10 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out of Portal
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 z-30">{content}</aside>

      {/* Mobile Drawer Backdrop & Sidebar */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="relative z-10">{content}</div>
        </div>
      )}
    </>
  );
};

