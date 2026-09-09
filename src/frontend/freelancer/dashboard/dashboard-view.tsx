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
import { TodayFocusCard } from './components/today-focus-card';
import { BusinessSnapshot } from './components/business-snapshot';
import { WorkspaceHealthCard } from './components/workspace-health-card';
import { ProjectHealthCard } from './components/project-health-card';
import { RevenueTrajectoryCard } from './components/revenue-trajectory-card';
import { PinnedItemsCard } from './components/pinned-items-card';
import { RecentWorkCard } from './components/recent-work-card';
import { GlobalActivityCard } from './components/global-activity-card';
import { TodayFocusItem, PinnedItem, RecentItem, ProjectHealthSummary, WorkspaceHealth } from '@/shared/types';

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
  workspaceHealthScore: 100,
  completionRate: 0,
  revenueGrowthPct: 0,
  completedProjectsCount: 0,
  pendingDeliverablesCount: 0,
  activeProjectsCount: 0,
  revenueHistory: [] as { month: string; amount: number }[],
};

const initialHealth: WorkspaceHealth = {
  score: 100,
  status: 'Healthy',
  metrics: {
    overdueInvoicesCount: 0,
    overdueInvoicesAmount: 0,
    lateProjectsCount: 0,
    unansweredCommentsCount: 0,
    pendingApprovalsCount: 0,
    missingDocumentsCount: 0,
    clientEngagementScore: 100,
  },
  recommendations: [],
  updatedAt: new Date().toISOString(),
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenClientWorkspace,
}) => {
  const { user, profile } = useAuth();
  const [metrics, setMetrics] = useState<any>(emptyMetrics);
  const [todayItems, setTodayItems] = useState<TodayFocusItem[]>([]);
  const [health, setHealth] = useState<WorkspaceHealth>(initialHealth);
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
      const overdueInvoices = pendingInvoices.filter((invoice: any) => invoice.status === 'overdue');
      const pendingDeliverables = (deliverables || []).filter((deliverable: any) => deliverable.status !== 'approved' && deliverable.status !== 'completed');
      const revisionDeliverables = pendingDeliverables.filter((deliverable: any) => deliverable.status === 'revision_requested');
      const pendingInvoiceAmount = pendingInvoices.reduce((sum: number, invoice: any) => sum + (Number(invoice.total) || Number(invoice.total_amount) || 0), 0);
      const overdueInvoiceAmount = overdueInvoices.reduce((sum: number, invoice: any) => sum + (Number(invoice.total) || Number(invoice.total_amount) || 0), 0);

      // Compute health score dynamically
      const overdueCount = overdueInvoices.length;
      const revisionCount = revisionDeliverables.length;
      const computedHealthScore = Math.max(0, 100 - overdueCount * 15 - revisionCount * 10);
      const healthStatus = computedHealthScore >= 90 ? 'Excellent' : computedHealthScore >= 75 ? 'Healthy' : computedHealthScore >= 50 ? 'Needs Attention' : 'Critical';

      // Compute average completion percentage across active projects
      const activeProjects = (projects || []).filter((p: any) => p.status !== 'completed' && p.status !== 'archived');
      const avgCompletion = activeProjects.length > 0
        ? Math.round(activeProjects.reduce((sum: number, p: any) => sum + (Number(p.completionPercentage) || Number(p.completion_percentage) || 0), 0) / activeProjects.length)
        : (projects?.length ? 100 : 0);

      // Compute revenue growth percentage from revenue history if available
      const revHist = realMetrics?.revenueHistory || [];
      let growthPct = 0;
      if (revHist.length >= 2) {
        const currentMonth = revHist[revHist.length - 1]?.amount || 0;
        const prevMonth = revHist[revHist.length - 2]?.amount || 0;
        if (prevMonth > 0) {
          growthPct = Math.round(((currentMonth - prevMonth) / prevMonth) * 100);
        }
      }

      setMetrics({
        activeClientsCount: realMetrics?.activeClientsCount ?? clients?.length ?? 0,
        activeProjectsCount: realMetrics?.activeProjectsCount ?? projects?.length ?? 0,
        pendingDeliverablesCount: realMetrics?.upcomingDeliverablesCount ?? pendingDeliverables.length,
        pendingInvoicesAmount: pendingInvoiceAmount,
        pendingInvoicesCount: pendingInvoices.length,
        pendingDocumentsCount: 0,
        workspaceHealthScore: computedHealthScore,
        completionRate: avgCompletion,
        revenueGrowthPct: growthPct,
        totalRevenue: realMetrics?.totalRevenue ?? 0,
        monthlyRevenue: realMetrics?.monthlyRevenue ?? 0,
        completedProjectsCount: realMetrics?.completedProjectsCount ?? 0,
        revenueHistory: revHist,
      });

      // Construct live Today's Focus action items
      const derived: TodayFocusItem[] = [];
      invoices
        ?.filter((invoice: any) => ['overdue', 'sent', 'pending'].includes(invoice.status))
        .slice(0, 3)
        .forEach((invoice: any) => {
          derived.push({
            id: `focus-inv-${invoice.id}`,
            title: `${invoice.status === 'overdue' ? 'Overdue' : 'Pending'} Invoice #${invoice.invoiceNumber || invoice.invoice_number || invoice.id}`,
            description: `$${Number(invoice.total || invoice.total_amount || 0).toLocaleString()} due on ${invoice.dueDate || invoice.due_date || 'no due date'}.`,
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
        .slice(0, 3)
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

      // Map project health summaries
      const mappedProjects: ProjectHealthSummary[] = (projects || []).map((project: any) => {
        const projDelivs = pendingDeliverables.filter((d: any) => d.clientId === project.clientId || d.projectId === project.id);
        const projRevisions = projDelivs.filter((d: any) => d.status === 'revision_requested');
        const projInvoices = pendingInvoices.filter((i: any) => i.clientId === project.clientId || i.projectId === project.id);
        const pct = project.completionPercentage ?? project.completion_percentage ?? 0;
        
        const reasons: string[] = [];
        if (projRevisions.length > 0) reasons.push(`${projRevisions.length} revision requested`);
        if (projInvoices.some((i: any) => i.status === 'overdue')) reasons.push('Overdue invoice pending');
        if (reasons.length === 0) reasons.push(pct >= 80 ? 'Near completion' : 'On schedule');

        return {
          projectId: project.id,
          projectTitle: project.title,
          clientName: project.clientName || 'Client Workspace',
          clientId: project.clientId,
          status: projRevisions.length > 0 ? 'Needs Attention' : pct >= 80 ? 'Excellent' : pct >= 40 ? 'Healthy' : 'Needs Attention',
          score: pct,
          completionPercentage: pct,
          overdueMilestones: 0,
          pendingDeliverables: projDelivs.length,
          revisionRequests: projRevisions.length,
          unpaidInvoices: projInvoices.length,
          reasons,
        };
      });
      setProjectSummaries(mappedProjects);

      // Derive recent items from real database records
      const derivedRecent: RecentItem[] = [];
      (projects || []).slice(0, 3).forEach((p: any) => {
        derivedRecent.push({
          id: `recent-proj-${p.id}`,
          resourceId: p.id,
          title: p.title || 'Untitled Project',
          subtitle: p.clientName || 'Active Project',
          type: 'project',
          path: 'projects',
          timestamp: p.updatedAt || p.updated_at ? 'Active' : 'Current',
          clientId: p.clientId || p.client_id,
        });
      });
      (deliverables || []).slice(0, 2).forEach((d: any) => {
        derivedRecent.push({
          id: `recent-deliv-${d.id}`,
          resourceId: d.id,
          title: d.title || 'Untitled Deliverable',
          subtitle: `${d.version || 'V1'} · ${d.status || 'in_progress'}`,
          type: 'deliverable',
          path: 'deliverables',
          timestamp: d.dueDate || d.due_date || 'In Review',
          clientId: d.clientId || d.client_id,
        });
      });
      setRecentItems(derivedRecent);

      // Load pinned items from local storage if available
      try {
        if (typeof window !== 'undefined') {
          const storedPins = localStorage.getItem('flowdesk_pinned_items');
          if (storedPins) {
            const parsed = JSON.parse(storedPins);
            if (Array.isArray(parsed)) setPinnedItems(parsed);
          }
        }
      } catch {
        // Fallback clean empty pinned items
      }

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

      // Build smart recommendations for workspace health
      const recommendations: any[] = [];
      if (overdueCount > 0) {
        recommendations.push({
          id: 'rec-overdue',
          title: 'Send Overdue Payment Reminders',
          description: `${overdueCount} invoice${overdueCount === 1 ? '' : 's'} are past due. Send a polite reminder to settle balances.`,
          impact: 'high',
          actionText: 'Review Invoices',
          actionType: 'send_reminder',
          targetType: 'invoice',
        });
      }
      if (revisionCount > 0) {
        recommendations.push({
          id: 'rec-revisions',
          title: 'Address Requested Revisions',
          description: `${revisionCount} deliverable${revisionCount === 1 ? '' : 's'} have client feedback ready for update.`,
          impact: 'high',
          actionText: 'Open Deliverables',
          actionType: 'approve_deliv',
          targetType: 'deliverable',
        });
      }
      if (recommendations.length === 0 && (clients?.length || projects?.length)) {
        recommendations.push({
          id: 'rec-healthy',
          title: 'Workspace Operating Optimally',
          description: 'All milestones, client portals, and deliverables are up to date with zero overdue items.',
          impact: 'low',
          actionText: 'View Projects',
          actionType: 'view_project',
          targetType: 'project',
        });
      }

      setHealth({
        score: computedHealthScore,
        status: healthStatus,
        metrics: {
          overdueInvoicesCount: overdueCount,
          overdueInvoicesAmount: overdueInvoiceAmount,
          lateProjectsCount: 0,
          unansweredCommentsCount: 0,
          pendingApprovalsCount: revisionCount,
          missingDocumentsCount: 0,
          clientEngagementScore: clients?.length ? Math.min(100, Math.max(70, 100 - overdueCount * 10)) : 100,
        },
        recommendations,
        updatedAt: new Date().toISOString(),
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
