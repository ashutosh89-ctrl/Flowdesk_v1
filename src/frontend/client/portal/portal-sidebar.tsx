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
import { isSafeImageUrl } from '@/shared/utils/safe-url';

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
  logoUrl?: string;
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
  logoUrl,
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
      badgeColor: 'bg-[#176B5B]/20 text-[#43D6B0] border-[#176B5B]/40',
    },
    {
      id: 'invoices',
      label: 'Invoices',
      icon: CreditCard,
      badge: unpaidInvoicesCount > 0 ? unpaidInvoicesCount : undefined,
      badgeColor: 'bg-[#176B5B]/20 text-[#43D6B0] border-[#176B5B]/40',
    },
    {
      id: 'comments',
      label: 'Comments',
      icon: MessageSquare,
      badge: unreadCommentsCount > 0 ? unreadCommentsCount : undefined,
      badgeColor: 'bg-[#176B5B]/20 text-[#43D6B0] border-[#176B5B]/40',
    },
    { id: 'activity', label: 'Activity', icon: Clock },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const content = (
    <div className="h-full flex flex-col justify-between p-4 bg-[#101312] backdrop-blur-2xl border-r border-[#176B5B]/30 w-64 text-[#F5F5F0] font-sans">
      <div className="space-y-6">
        {/* Brand / Client Workspace Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#176B5B]/20">
          <div className="flex items-center gap-3">
            {logoUrl && isSafeImageUrl(logoUrl) ? (
              <div className="w-9 h-9 rounded-xl bg-[#191F1D] border border-[#176B5B]/30 flex items-center justify-center p-1.5 shadow-lg shadow-black/40 shrink-0 overflow-hidden">
                <img src={logoUrl} alt={companyName || 'Logo'} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#176B5B] text-[#F5F5F0] font-extrabold flex items-center justify-center text-base shadow-lg shadow-[#176B5B]/25 shrink-0">
                {companyName ? companyName.charAt(0) : 'C'}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#F5F5F0] tracking-tight truncate">{companyName}</h2>
              <p className="text-[11px] text-[#A6B4AE] truncate">Client Portal</p>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-[#A6B4AE] hover:text-[#F5F5F0] hover:bg-[#176B5B]/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Client Welcome Tag */}
        <div className="px-3 py-2.5 rounded-xl bg-[#191F1D] border border-[#176B5B]/30 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[#43D6B0] shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-mono text-[#A6B4AE] font-semibold tracking-wider">Logged in as</p>
            <p className="text-xs font-semibold text-[#F5F5F0] truncate">{clientName}</p>
          </div>
        </div>

        {/* Client Portal Main Nav */}
        <nav className="space-y-1" role="navigation" aria-label="Portal Navigation">
          <p className="px-3 text-[10px] font-mono text-[#A6B4AE] uppercase tracking-widest font-semibold mb-2">
            Workspace Nav
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onTabChange(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-180 group relative text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#43D6B0]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101312] ${
                  isActive
                    ? 'bg-[#176B5B]/20 text-[#F5F5F0] font-semibold border border-[#176B5B]/50'
                    : 'text-[#A6B4AE] hover:text-[#F5F5F0] hover:bg-[#191F1D] border border-transparent hover:border-[#176B5B]/30'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-180 ${
                      isActive
                        ? 'bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/60'
                        : 'bg-transparent text-[#A6B4AE] border border-transparent group-hover:bg-[#176B5B]/15 group-hover:border-[#176B5B]/30 group-hover:text-[#43D6B0]'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 transition-transform duration-180 transform group-hover:scale-110 motion-reduce:transform-none ${
                        isActive ? 'text-[#43D6B0] scale-105' : 'text-[#A6B4AE]'
                      }`}
                    />
                  </div>
                  <span className="transition-transform duration-180 group-hover:translate-x-0.5 motion-reduce:transform-none">
                    {item.label}
                  </span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono border font-bold transition-transform duration-180 group-hover:scale-105 ${
                      isActive ? 'bg-[#176B5B]/40 text-[#43D6B0] border-[#176B5B]/60' : item.badgeColor
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
      <div className="pt-4 border-t border-[#176B5B]/20 space-y-2.5">
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

        <div className="p-3 rounded-xl bg-[#176B5B]/10 border border-[#176B5B]/25 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#43D6B0] shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-[#43D6B0]">Magic Access Security</p>
            <p className="text-[10px] text-[#A6B4AE] leading-relaxed mt-0.5">
              Encrypted authenticated access provided by your service provider.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 py-1 text-[11px] text-[#A6B4AE] font-medium select-none">
          <img src="/branding/flowdesk-symbol.png" alt="FlowDesk" className="w-4 h-4 object-contain opacity-70" />
          <span className="tracking-wide">Powered by FlowDesk</span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#A6B4AE] hover:text-[#F5F5F0] bg-[#191F1D] hover:bg-[#176B5B]/20 border border-[#176B5B]/30 transition-colors"
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

