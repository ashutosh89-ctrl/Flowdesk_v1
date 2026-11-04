import React, { useState, useEffect } from 'react';
import { Tabs, TabItem } from '@/frontend/shared/ui/tabs';
import { Button } from '@/frontend/shared/ui/button';
import { Avatar } from '@/frontend/shared/ui/avatar';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { HealthBadge } from '@/frontend/shared/ui/health-badge';
import { WorkspaceService } from '@/backend/freelancer';
import { supabase } from '@/backend/utilities/supabase';
import { WorkspaceSummary } from '@/shared/types';
import { OverviewTab } from './tabs/overview-tab';
import { ProjectsTab } from './tabs/projects-tab';
import { TimelineTab } from './tabs/timeline-tab';
import { DocumentsTab } from './tabs/documents-tab';
import { DeliverablesTab } from './tabs/deliverables-tab';
import { CommentsTab } from './tabs/comments-tab';
import { InvoicesTab } from './tabs/invoices-tab';
import { ClientPortalTab } from './tabs/client-portal-tab';
import { ActivityTab } from './tabs/activity-tab';
import { WorkspaceSettingsTab } from './tabs/workspace-settings-tab';
import {
  ArrowLeft,
  LayoutDashboard,
  FolderKanban,
  Clock,
  FileText,
  CheckCircle2,
  MessageSquare,
  Receipt,
  Globe,
  Plus,
  Copy,
  Activity,
  Settings,
  Link2,
} from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';

export interface ClientWorkspaceShellProps {
  clientId: string;
  onBackToClients: () => void;
}

export const ClientWorkspaceShell: React.FC<ClientWorkspaceShellProps> = ({
  clientId,
  onBackToClients,
}) => {
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [historyView, setHistoryView] = useState<'timeline' | 'activity'>('timeline');
  const [permanentPortalUrl, setPermanentPortalUrl] = useState<string>('');
  const { showToast } = useToast();

  const loadSummary = React.useCallback(() => {
    WorkspaceService.getWorkspaceSummary(clientId).then((res) => {
      if (res) setSummary(res);
    });
  }, [clientId]);

  useEffect(() => {
    loadSummary();

    // 1. Proactive Polling: Checks every 90 seconds (Supabase realtime handles instant events)
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadSummary();
      }
    }, 90000);

    // 2. Window Focus & Visibility Change: Instantly re-queries when returning to tab
    const onWindowFocus = () => {
      loadSummary();
    };
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onWindowFocus);

    // 3. Supabase Realtime Channel: Instantly sync when client actions occur
    let channel: any = null;
    try {
      channel = supabase
        .channel(`workspace-sync-${clientId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deliverables' }, () => {
          loadSummary();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
          loadSummary();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, () => {
          loadSummary();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deliverable_comments' }, () => {
          loadSummary();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_comments' }, () => {
          loadSummary();
        })
        .subscribe();
    } catch {
      // Realtime non-blocking
    }

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onWindowFocus);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [loadSummary, clientId]);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/portal/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.portalUrl) {
          setPermanentPortalUrl(data.portalUrl);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  if (!summary) {
    return (
      <div className="space-y-6 animate-pulse p-2">
        <div className="h-10 bg-white/5 rounded-xl w-52 border border-white/10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white/5 rounded-2xl border border-white/10" />
          ))}
        </div>
        <div className="h-96 bg-white/5 rounded-2xl border border-white/10" />
      </div>
    );
  }

  const { client, portalConfig } = summary;

  const tabItems: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'projects', label: 'Projects', count: summary.projects.length, icon: <FolderKanban className="w-4 h-4" /> },
    { id: 'deliverables', label: 'Deliverables', count: summary.deliverables.length, icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', count: summary.documents.length, icon: <FileText className="w-4 h-4" /> },
    { id: 'invoices', label: 'Invoices', count: summary.invoices.length, icon: <Receipt className="w-4 h-4" /> },
    { id: 'comments', label: 'Messages', count: summary.comments.length, icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'history', label: 'History', icon: <Clock className="w-4 h-4" /> },
    { id: 'portal', label: 'Portal', icon: <Link2 className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const handleCopyPortalLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    // Prefer the permanent connection link; fallback to client workspace route
    const portalUrl =
      permanentPortalUrl ||
      (client?.id ? `${origin}/portal/${client.id}` : `${origin}/portal/join/fd_demo_studio`);

    if (!portalUrl) return;
    navigator.clipboard?.writeText(portalUrl);
    showToast(
      'Permanent Portal Link Copied',
      'Share this permanent link with your client to connect their FlowDesk account.',
      'success'
    );
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0 pb-8">
      {/* Workspace Header */}
      <div className="pb-6 border-b border-white/10 space-y-4">
        <button
          onClick={onBackToClients}
          className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1.5 transition-colors font-mono py-1.5 px-2 -ml-2 rounded-lg hover:bg-white/5 active:bg-white/10 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#43D6B0]" /> Back to Clients Directory
        </button>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={client.name} src={client.avatarUrl} size="xl" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {client.company}
                </h1>
                <StatusPill status={client.status} />
                <HealthBadge level={client.healthBadge} score={summary.health.score} showScore />
                {client.country && (
                  <span className="text-xs font-mono text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                    {client.country}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Contact: <strong className="text-white">{client.name}</strong> ({client.email})
                {client.phone && <span> • {client.phone}</span>}
              </p>
            </div>
          </div>

          {/* Quick Action Bar for Client */}
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 sm:flex-initial"
              onClick={handleCopyPortalLink}
              leftIcon={<Copy className="w-3.5 h-3.5" />}
            >
              Copy Portal Link
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="flex-1 sm:flex-initial"
              onClick={() => setActiveTab('deliverables')}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Submit Deliverable
            </Button>
          </div>
        </div>

        {/* Workspace Nav Tabs */}
        <div className="pt-2 w-full max-w-full min-w-0">
          <Tabs
            id="client-workspace"
            items={tabItems}
            activeTab={activeTab}
            onChange={setActiveTab}
            variant="glass"
          />
        </div>
      </div>

      {/* Tab View Contents */}
      <div>
        {activeTab === 'overview' && <OverviewTab summary={summary} onRefresh={loadSummary} onTabChange={setActiveTab} />}
        {activeTab === 'projects' && <ProjectsTab summary={summary} onRefresh={loadSummary} />}
        {activeTab === 'invoices' && <InvoicesTab summary={summary} onRefresh={loadSummary} />}
        {activeTab === 'deliverables' && <DeliverablesTab summary={summary} onRefresh={loadSummary} />}
        {activeTab === 'documents' && <DocumentsTab summary={summary} onRefresh={loadSummary} />}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center gap-1 p-1 bg-zinc-900/60 border border-white/10 rounded-xl max-w-xs">
              {['timeline', 'activity'].map((sub) => (
                <button
                  key={sub}
                  onClick={() => setHistoryView(sub as 'timeline' | 'activity')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                    historyView === sub ? 'bg-white text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {sub === 'timeline' ? 'Timeline' : 'Audit Activity'}
                </button>
              ))}
            </div>
            {historyView === 'timeline' ? <TimelineTab summary={summary} /> : <ActivityTab summary={summary} />}
          </div>
        )}
        {activeTab === 'comments' && <CommentsTab summary={summary} onRefresh={loadSummary} />}
        {activeTab === 'portal' && <ClientPortalTab summary={summary} onRefresh={loadSummary} />}
        {activeTab === 'settings' && (
          <WorkspaceSettingsTab
            summary={summary}
            onRefresh={loadSummary}
            onCloseWorkspace={onBackToClients}
          />
        )}
      </div>
    </div>
  );
};
