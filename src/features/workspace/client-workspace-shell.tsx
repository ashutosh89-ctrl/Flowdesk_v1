import React, { useState, useEffect } from 'react';
import { Tabs, TabItem } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Avatar } from '../../components/ui/avatar';
import { StatusPill } from '../../components/ui/status-pill';
import { WorkspaceService } from '../../services';
import { WorkspaceSummary } from '../../types';
import { OverviewTab } from './tabs/overview-tab';
import { TimelineTab } from './tabs/timeline-tab';
import { DocumentsTab } from './tabs/documents-tab';
import { DeliverablesTab } from './tabs/deliverables-tab';
import { CommentsTab } from './tabs/comments-tab';
import { InvoicesTab } from './tabs/invoices-tab';
import { ClientPortalTab } from './tabs/client-portal-tab';
import {
  ArrowLeft,
  LayoutDashboard,
  Clock,
  FileText,
  CheckCircle2,
  MessageSquare,
  Receipt,
  Globe,
  ShieldCheck,
  Plus,
  Upload,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '../../components/ui/toast';

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
  const { showToast } = useToast();

  const loadSummary = React.useCallback(() => {
    WorkspaceService.getWorkspaceSummary(clientId).then(setSummary);
  }, [clientId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (!summary) return null;

  const { client, portalConfig } = summary;

  const tabItems: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'timeline', label: 'Timeline', icon: <Clock className="w-4 h-4" /> },
    { id: 'documents', label: 'Documents', count: summary.documents.length, icon: <FileText className="w-4 h-4" /> },
    { id: 'deliverables', label: 'Deliverables', count: summary.deliverables.length, icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'comments', label: 'Comments', count: summary.comments.length, icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'invoices', label: 'Invoices', count: summary.invoices.length, icon: <Receipt className="w-4 h-4" /> },
    { id: 'portal', label: 'Client Portal', icon: <Globe className="w-4 h-4" /> },
  ];

  const handleCopyPortalLink = () => {
    const portalUrl = `https://flowdesk.app/portal/${portalConfig.magicKey}`;
    navigator.clipboard?.writeText(portalUrl);
    showToast('Link Copied', 'Magic portal link copied to clipboard.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="pb-6 border-b border-white/10 space-y-4">
        <button
          onClick={onBackToClients}
          className="text-xs text-zinc-400 hover:text-white inline-flex items-center gap-1 transition-colors font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Clients Directory
        </button>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={client.name} src={client.avatarUrl} size="xl" />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {client.company}
                </h1>
                <StatusPill status={client.status} />
                {client.country && (
                  <span className="text-xs font-mono text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                    {client.country}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-400 mt-1">
                Contact: <strong className="text-white">{client.name}</strong> ({client.email})
              </p>
            </div>
          </div>

          {/* Quick Action Bar for Client */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyPortalLink}
              leftIcon={<Copy className="w-3.5 h-3.5" />}
            >
              Copy Portal Link
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setActiveTab('deliverables')}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Submit Deliverable
            </Button>
          </div>
        </div>

        {/* Workspace Nav Tabs */}
        <div className="pt-2">
          <Tabs items={tabItems} activeTab={activeTab} onChange={setActiveTab} variant="glass" />
        </div>
      </div>

      {/* Tab View Contents */}
      <div>
        {activeTab === 'overview' && <OverviewTab summary={summary} onRefresh={loadSummary} onTabChange={setActiveTab} />}
        {activeTab === 'timeline' && <TimelineTab summary={summary} />}
        {activeTab === 'documents' && <DocumentsTab summary={summary} onRefresh={loadSummary} />}
        {activeTab === 'deliverables' && <DeliverablesTab summary={summary} onRefresh={loadSummary} />}
        {activeTab === 'comments' && <CommentsTab summary={summary} onRefresh={loadSummary} />}
        {activeTab === 'invoices' && <InvoicesTab summary={summary} onRefresh={loadSummary} />}
        {activeTab === 'portal' && <ClientPortalTab summary={summary} onRefresh={loadSummary} />}
      </div>
    </div>
  );
};
