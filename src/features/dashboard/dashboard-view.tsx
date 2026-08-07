import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Plus,
  Bell,
  Settings,
  FolderKanban,
  FileText,
  Users,
  ShieldCheck,
  Zap,
  LayoutGrid,
  TrendingUp,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FlowDeskStore } from '../../services/storage-store';
import { TodayFocusCard } from './components/today-focus-card';
import { BusinessSnapshot } from './components/business-snapshot';
import { WorkspaceHealthCard } from './components/workspace-health-card';
import { ProjectHealthCard } from './components/project-health-card';
import { RevenueTrajectoryCard } from './components/revenue-trajectory-card';
import { PinnedItemsCard } from './components/pinned-items-card';
import { RecentWorkCard } from './components/recent-work-card';
import { GlobalActivityCard } from './components/global-activity-card';
import { GlobalSearchModal } from './components/global-search-modal';
import { QuickActionsModal } from './components/quick-actions-modal';
import { NotificationCenterDrawer } from './components/notification-center-drawer';
import { WorkspaceSettingsModal } from './components/workspace-settings-modal';
import { TodayFocusItem } from '../../types';

export interface DashboardViewProps {
  onNavigate: (view: string) => void;
  onOpenClientWorkspace: (clientId: string) => void;
  onQuickAction: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenClientWorkspace,
  onQuickAction,
}) => {
  const [userProfile, setUserProfile] = useState(() => FlowDeskStore.getUserProfile());
  const [metrics, setMetrics] = useState(() => FlowDeskStore.getBusinessMetrics());
  const [todayItems, setTodayItems] = useState(() => FlowDeskStore.getTodayFocusList());
  const [health, setHealth] = useState(() => FlowDeskStore.getWorkspaceHealth());
  const [projectSummaries, setProjectSummaries] = useState(() => FlowDeskStore.getProjectHealthSummaries());
  const [pinnedItems, setPinnedItems] = useState(() => FlowDeskStore.getPinnedItems());
  const [recentItems, setRecentItems] = useState(() => FlowDeskStore.getRecentWork());
  const [activities, setActivities] = useState(() => FlowDeskStore.getActivities());
  const [notifications, setNotifications] = useState(() => FlowDeskStore.getNotifications());

  // Modal States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const refreshData = () => {
    setUserProfile(FlowDeskStore.getUserProfile());
    setMetrics(FlowDeskStore.getBusinessMetrics());
    setTodayItems(FlowDeskStore.getTodayFocusList());
    setHealth(FlowDeskStore.getWorkspaceHealth());
    setProjectSummaries(FlowDeskStore.getProjectHealthSummaries());
    setPinnedItems(FlowDeskStore.getPinnedItems());
    setRecentItems(FlowDeskStore.getRecentWork());
    setActivities(FlowDeskStore.getActivities());
    setNotifications(FlowDeskStore.getNotifications());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleActionFromFocus = (item: TodayFocusItem) => {
    if (item.actionType === 'pay_invoice') {
      onNavigate('invoices');
    } else if (item.actionType === 'view_deliverable') {
      onNavigate('deliverables');
    } else if (item.actionType === 'view_documents') {
      onNavigate('documents');
    } else {
      if (item.clientId) {
        onOpenClientWorkspace(item.clientId);
      } else {
        onNavigate('clients');
      }
    }
  };

  const handleUnpin = (resourceId: string) => {
    FlowDeskStore.unpinItem(resourceId);
    setPinnedItems(FlowDeskStore.getPinnedItems());
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8 select-none">
      {/* Top Header Bar & Mission Control Navigation */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              MISSION CONTROL • FLOWDESK OS
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {getGreeting()}, {userProfile.name}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {userProfile.companyName || 'Rivera Studio'} Workspace • All client hubs operational.
          </p>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          {/* Universal Search Button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="px-3 py-2 text-xs font-semibold bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-all flex items-center gap-2 shadow-sm"
          >
            <Search className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Search Workspace...</span>
            <kbd className="hidden sm:inline text-[9px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-zinc-400">
              ⌘K
            </kbd>
          </button>

          {/* Quick Create Action Button */}
          <button
            onClick={() => setIsQuickActionsOpen(true)}
            className="px-3 py-2 text-xs font-bold bg-white hover:bg-amber-400 text-zinc-950 rounded-xl transition-all flex items-center gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Create</span>
          </button>

          {/* Notification Bell Button */}
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="relative p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/10 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Settings Gear Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/10 transition-colors"
            title="Workspace Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row 1: Today's Focus Card (Priority Decision Engine) */}
      <TodayFocusCard
        items={todayItems}
        onAction={handleActionFromFocus}
        onNavigate={onNavigate}
      />

      {/* Row 2: Business Intelligence Snapshot */}
      <BusinessSnapshot metrics={metrics} onNavigate={onNavigate} />

      {/* Row 3: Workspace Health Score & Revenue Trajectory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <WorkspaceHealthCard
            health={health}
            onNavigate={onNavigate}
            onAction={(actionType) => {
              if (actionType === 'send_reminder') onNavigate('invoices');
              else if (actionType === 'approve_deliv') onNavigate('deliverables');
              else onNavigate('documents');
            }}
          />
        </div>

        <div className="lg:col-span-2">
          <RevenueTrajectoryCard
            totalRevenue={metrics.totalRevenue}
            monthlyRevenue={metrics.monthlyRevenue}
            pendingInvoicesAmount={metrics.pendingInvoicesAmount}
            revenueHistory={FlowDeskStore.getDashboardMetrics().revenueHistory}
            onNavigate={onNavigate}
          />
        </div>
      </div>

      {/* Row 4: Project Health Radar */}
      <ProjectHealthCard summaries={projectSummaries} onNavigate={onNavigate} />

      {/* Row 5: Productivity Layer (Pinned Items & Recent Work) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PinnedItemsCard
          items={pinnedItems}
          onUnpin={handleUnpin}
          onNavigate={onNavigate}
        />
        <RecentWorkCard items={recentItems} onNavigate={onNavigate} />
      </div>

      {/* Row 6: Global Activity Stream */}
      <GlobalActivityCard activities={activities} onNavigate={onNavigate} />

      {/* MODALS & DRAWERS */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={onNavigate}
      />

      <QuickActionsModal
        isOpen={isQuickActionsOpen}
        onClose={() => setIsQuickActionsOpen(false)}
        onNavigate={onNavigate}
        onRefresh={refreshData}
      />

      <NotificationCenterDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onRefresh={refreshData}
        onNavigate={onNavigate}
      />

      <WorkspaceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onRefresh={refreshData}
      />
    </div>
  );
};
