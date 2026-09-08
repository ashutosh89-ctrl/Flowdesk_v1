import React, { useEffect, useState } from 'react';
import { useAuth } from '@/frontend/auth/auth-context';
import { isDemoModeActive } from '@/backend/utilities/supabase';
import {
  DashboardService,
  ActivityService,
  NotificationService,
  ProjectService,
  DeliverableService,
  InvoiceService,
  ClientService,
} from '@/backend/freelancer';
import { FlowDeskStore } from '@/backend/store/storage-store';
import { TodayFocusCard } from './components/today-focus-card';
import { BusinessSnapshot } from './components/business-snapshot';
import { WorkspaceHealthCard } from './components/workspace-health-card';
import { ProjectHealthCard } from './components/project-health-card';
import { RevenueTrajectoryCard } from './components/revenue-trajectory-card';
import { PinnedItemsCard } from './components/pinned-items-card';
import { RecentWorkCard } from './components/recent-work-card';
import { GlobalActivityCard } from './components/global-activity-card';
import { TodayFocusItem, PinnedItem, RecentItem, ProjectHealthSummary } from '@/shared/types';

export interface DashboardViewProps {
  onNavigate: (view: string) => void;
  onOpenClientWorkspace: (clientId: string) => void;
  onQuickAction: () => void;
}

const emptyMetrics = {
  totalRevenue: 0,
  monthlyRevenue: 0,
  activeClientsCount: 0,
  pendingInvoicesAmount: 0,
  pendingInvoicesCount: 0,
  pendingDocumentsCount: 0,
  workspaceHealthScore: 0,
  completionRate: 0,
  revenueGrowthPct: 0,
  completedProjectsCount: 0,
  pendingDeliverablesCount: 0,
  activeProjectsCount: 0,
  revenueHistory: [] as { month: string; amount: number }[],
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenClientWorkspace,
}) => {
  const { user, profile } = useAuth();
  const [metrics, setMetrics] = useState<any>(emptyMetrics);
  const [todayItems, setTodayItems] = useState<TodayFocusItem[]>([]);
  const [health, setHealth] = useState<any>({ score: 0, status: 'No data', reasons: [] });
  const [projectSummaries, setProjectSummaries] = useState<ProjectHealthSummary[]>([]);
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showSecondaryDashboard, setShowSecondaryDashboard] = useState(false);

  const refreshData = async () => {
    try {
      const [realMetrics, realActs, realNotifs, projects, deliverables, invoices, clients] =
        await Promise.all([
          DashboardService.getMetrics(),
          ActivityService.getActivities(),
          NotificationService.getNotifications(),
          ProjectService.getProjects(),
          DeliverableService.getDeliverables(),
          InvoiceService.getInvoices(),
          ClientService.getClients(),
        ]);

      const pendingInvoices = (invoices || []).filter((invoice: any) => invoice.status !== 'paid');
      const pendingDeliverables = (deliverables || []).filter((deliverable: any) => deliverable.status !== 'approved' && deliverable.status !== 'completed');
      const pendingDocuments = 0;
      const pendingInvoiceAmount = pendingInvoices.reduce((sum: number, invoice: any) => sum + (Number(invoice.total) || Number(invoice.total_amount) || 0), 0);

      setMetrics({
        activeClientsCount: realMetrics?.activeClientsCount ?? clients?.length ?? 0,
        activeProjectsCount: realMetrics?.activeProjectsCount ?? projects?.length ?? 0,
        pendingDeliverablesCount: realMetrics?.upcomingDeliverablesCount ?? pendingDeliverables.length,
        pendingInvoicesAmount: realMetrics?.pendingInvoicesAmount ?? pendingInvoiceAmount,
        pendingInvoicesCount: pendingInvoices.length,
        pendingDocumentsCount: pendingDocuments,
        workspaceHealthScore: 0,
        completionRate: 0,
        revenueGrowthPct: 0,
        totalRevenue: realMetrics?.totalRevenue ?? 0,
        monthlyRevenue: realMetrics?.monthlyRevenue ?? 0,
        completedProjectsCount: realMetrics?.completedProjectsCount ?? 0,
        revenueHistory: realMetrics?.revenueHistory ?? [],
      });

      // Demo mode may use the local seeded store. Production must never read
      // FlowDeskStore for dashboard decisions because it contains demo fixtures.
      if (isDemoModeActive()) {
        const storeFocus = FlowDeskStore.getTodayFocusList();
        if (storeFocus.length > 0) setTodayItems(storeFocus);
      } else {
        const derived: TodayFocusItem[] = [];
        invoices
          ?.filter((invoice: any) => ['overdue', 'sent', 'pending'].includes(invoice.status))
          .slice(0, 2)
          .forEach((invoice: any) => {
            derived.push({
              id: `focus-inv-${invoice.id}`,
              title: `${invoice.status === 'overdue' ? 'Overdue' : 'Pending'} Invoice #${invoice.invoiceNumber || invoice.id}`,
              description: `${Number(invoice.total || invoice.total_amount || 0).toLocaleString()} due on ${invoice.dueDate || invoice.due_date || 'no due date'}.`,
              category: 'overdue_invoice',
              priority: invoice.status === 'overdue' ? 'critical' : 'high',
              dueDate: invoice.dueDate || invoice.due_date,
              clientName: invoice.clientName,
              clientId: invoice.clientId || invoice.client_id,
              actionText: 'Review Invoice',
              actionType: 'pay_invoice',
              targetId: invoice.id,
              createdAt: invoice.dueDate || invoice.due_date || new Date().toISOString(),
            });
          });

        deliverables
          ?.filter((deliverable: any) => deliverable.status === 'revision_requested' || deliverable.status === 'ready_for_review')
          .slice(0, 2)
          .forEach((deliverable: any) => {
            derived.push({
              id: `focus-del-${deliverable.id}`,
              title: deliverable.status === 'revision_requested' ? `Revision Requested: ${deliverable.title}` : `Review Ready: ${deliverable.title}`,
              description: `${deliverable.version || 'Current version'} for ${deliverable.clientName || 'Client Workspace'}. ${deliverable.revisionNote || 'Awaiting review.'}`,
              category: deliverable.status === 'revision_requested' ? 'revision_requested' : 'deliverable_due',
              priority: deliverable.status === 'revision_requested' ? 'high' : 'medium',
              dueDate: deliverable.dueDate,
              clientName: deliverable.clientName,
              clientId: deliverable.clientId,
              actionText: 'Open Deliverable',
              actionType: 'view_deliverable',
              targetId: deliverable.id,
              createdAt: deliverable.updatedAt || new Date().toISOString(),
            });
          });

        setTodayItems(derived);
      }

      const mappedProjects: ProjectHealthSummary[] = (projects || []).map((project: any) => ({
        projectId: project.id,
        projectTitle: project.title,
        clientName: project.clientName || 'Client Workspace',
        clientId: project.clientId,
        status: project.completionPercentage >= 80 ? 'Excellent' : project.completionPercentage >= 40 ? 'Healthy' : 'Needs Attention',
        score: project.completionPercentage || 0,
        completionPercentage: project.completionPercentage || 0,
        overdueMilestones: 0,
        pendingDeliverables: pendingDeliverables.filter((d: any) => d.clientId === project.clientId).length,
        revisionRequests: pendingDeliverables.filter((d: any) => d.clientId === project.clientId && d.status === 'revision_requested').length,
        unpaidInvoices: pendingInvoices.filter((i: any) => i.clientId === project.clientId).length,
        reasons: [],
      }));
      setProjectSummaries(mappedProjects);

      setActivities(
        (realActs || []).map((activity: any, idx: number) => ({
          id: activity.id || `activity-${idx}`,
          user: activity.user || activity.user_name || 'User',
          action: activity.action || 'updated resource',
          target: activity.target || activity.title || 'Workspace',
          timestamp: activity.timestamp || 'Just now',
          category: activity.category || activity.resource_type || 'project',
        }))
      );

      setNotifications(
        (realNotifs || []).map((notification: any) => ({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          read: notification.read,
          timestamp: notification.timestamp,
          type: notification.type,
          link: notification.link,
        }))
      );

      const overdueCount = pendingInvoices.filter((invoice: any) => invoice.status === 'overdue').length;
      const revisionCount = pendingDeliverables.filter((deliverable: any) => deliverable.status === 'revision_requested').length;
      const healthScore = Math.max(0, 100 - overdueCount * 15 - revisionCount * 10);
      const healthReasons: string[] = [];
      if (overdueCount > 0) healthReasons.push(`${overdueCount} overdue invoice${overdueCount === 1 ? '' : 's'}`);
      if (revisionCount > 0) healthReasons.push(`${revisionCount} revision request${revisionCount === 1 ? '' : 's'} awaiting action`);
      if (healthReasons.length === 0 && (clients?.length || projects?.length)) healthReasons.push('No outstanding issues detected');

      setHealth({
        score: healthScore,
        status: healthScore >= 80 ? 'Healthy' : healthScore >= 50 ? 'Needs Attention' : 'Critical',
        reasons: healthReasons,
      });
    } catch (err) {
      console.warn('Dashboard data refresh notice:', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleActionFromFocus = (item: TodayFocusItem) => {
    if (item.actionType === 'pay_invoice') onNavigate('invoices');
    else if (item.actionType === 'view_deliverable') onNavigate('deliverables');
    else if (item.actionType === 'view_documents') onNavigate('documents');
    else if (item.clientId) onOpenClientWorkspace(item.clientId);
    else onNavigate('clients');
  };

  const handleUnpin = (resourceId: string) => {
    setPinnedItems((prev) => prev.filter((item) => item.id !== resourceId));
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = profile?.name ?? user?.email?.split('@')[0] ?? 'User';
  const displayCompany = profile?.companyName || 'My Workspace';

  return (
    <div className="space-y-8 select-none">
      <div className="pb-6 border-b border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
            MISSION CONTROL • FLOWDESK OS
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {getGreeting()}, {displayName}
        </h1>
        <p className="text-xs text-zinc-400 mt-1">{displayCompany} Workspace</p>
      </div>

      <TodayFocusCard items={todayItems} onAction={handleActionFromFocus} onNavigate={onNavigate} />
      <BusinessSnapshot metrics={metrics} onNavigate={onNavigate} />
      <ProjectHealthCard summaries={projectSummaries} onNavigate={onNavigate} />

      <div className="border border-white/5 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowSecondaryDashboard(!showSecondaryDashboard)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-xs font-semibold text-zinc-400 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <svg className={`w-3.5 h-3.5 transition-transform ${showSecondaryDashboard ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            Additional Insights
          </span>
          <span className="text-[10px] font-mono text-zinc-500">{showSecondaryDashboard ? 'Collapse' : 'Expand'}</span>
        </button>

        {showSecondaryDashboard && (
          <div className="p-5 space-y-6 border-t border-white/5">
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
                  revenueHistory={metrics.revenueHistory || []}
                  onNavigate={onNavigate}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PinnedItemsCard items={pinnedItems} onUnpin={handleUnpin} onNavigate={onNavigate} />
              <RecentWorkCard items={recentItems} onNavigate={onNavigate} />
            </div>

            <GlobalActivityCard activities={activities} onNavigate={onNavigate} />
          </div>
        )}
      </div>
    </div>
  );
};
