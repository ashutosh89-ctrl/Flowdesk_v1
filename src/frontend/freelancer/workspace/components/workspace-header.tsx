import React from 'react';
import { Client, WorkspaceSummary } from '@/shared/types';
import { Avatar } from '@/frontend/shared/ui/avatar';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { HealthBadge } from '@/frontend/shared/ui/health-badge';
import { Button } from '@/frontend/shared/ui/button';
import {
  ArrowLeft,
  Globe,
  Mail,
  Phone,
  Clock,
  ExternalLink,
  Plus,
  RefreshCw,
  FolderKanban,
  FileText,
  Receipt,
  Layers,
  Activity,
  Settings,
  ShieldCheck,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

export interface WorkspaceHeaderProps {
  client: Client;
  summary: WorkspaceSummary;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onBackToClients: () => void;
  onRefresh: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  client,
  summary,
  activeTab,
  onTabChange,
  onBackToClients,
  onRefresh,
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'projects', label: `Projects (${summary.projects.length})`, icon: <FolderKanban className="w-3.5 h-3.5" /> },
    { id: 'invoices', label: `Invoices (${summary.invoices.length})`, icon: <Receipt className="w-3.5 h-3.5" /> },
    { id: 'deliverables', label: `Deliverables (${summary.deliverables.length})`, icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'documents', label: `Documents (${summary.documents.length})`, icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'timeline', label: 'Timeline', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'activity', label: 'Audit Activity', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'comments', label: `Messages (${summary.comments.length})`, icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: 'portal', label: 'Magic Portal', icon: <ExternalLink className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToClients}
          className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-500 group-hover:-translate-x-1 transition-transform" />
          <span>Clients Directory</span>
          <span className="text-zinc-600">/</span>
          <strong className="text-white font-semibold">{client.company}</strong>
        </button>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onRefresh} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Sync Engine
          </Button>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="p-6 rounded-2xl bg-zinc-900/80 border border-white/10 backdrop-blur-xl relative overflow-hidden space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={client.name} src={client.avatarUrl} size="lg" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-white tracking-tight">{client.company}</h1>
                <StatusPill status={client.status} />
                <HealthBadge level={client.healthBadge} score={summary.health.score} showScore />
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-3 flex-wrap">
                <span>Contact: <strong className="text-white">{client.name}</strong></span>
                <span className="text-zinc-600">•</span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-zinc-500" /> {client.email}
                </span>
                {client.phone && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-zinc-500" /> {client.phone}
                    </span>
                  </>
                )}
                {client.country && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
                      <Globe className="w-3 h-3 text-zinc-500" /> {client.country}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-right">
              <span className="text-[10px] text-zinc-500 block uppercase">Lifetime Billed</span>
              <span className="text-sm font-bold text-emerald-400">
                ${client.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto pt-2 border-t border-white/10 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.25)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
