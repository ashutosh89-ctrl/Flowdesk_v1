'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import {
  CheckSquare,
  FileText,
  CreditCard,
  AlertCircle,
  ArrowRight,
  Clock,
  Download,
  Upload,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Folder,
} from 'lucide-react';
import {
  Client,
  Project,
  Deliverable,
  DocumentItem,
  Invoice,
  PortalActivity,
} from '@/shared/types';

interface OverviewCardsProps {
  client: Client;
  projects: Project[];
  deliverables: Deliverable[];
  documents: DocumentItem[];
  invoices: Invoice[];
  activities: PortalActivity[];
  pendingApprovalsCount: number;
  pendingDocumentsCount: number;
  outstandingInvoicesTotal: number;
  onNavigateTab: (tab: any) => void;
  onApproveClick: (deliv: Deliverable) => void;
  onUploadClick: (doc: DocumentItem) => void;
  onPayClick: (inv: Invoice) => void;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  client,
  projects,
  deliverables,
  documents,
  invoices,
  activities,
  pendingApprovalsCount,
  pendingDocumentsCount,
  outstandingInvoicesTotal,
  onNavigateTab,
  onApproveClick,
  onUploadClick,
  onPayClick,
}) => {
  // Compute overall workspace progress across active projects
  const totalCompletion = projects.length > 0
    ? Math.round(projects.reduce((acc, p) => acc + (p.completionPercentage || 0), 0) / projects.length)
    : 0;

  const pendingDeliverables = deliverables.filter(d => d.status === 'ready_for_review' || d.status === 'submitted' || d.status === 'preparing');
  const pendingDocs = documents.filter(d => d.status === 'pending' || d.isRequired);
  const unpaidInvoices = invoices.filter(i => i.paymentStatus !== 'paid');

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <Card variant="crystal" className="p-6 sm:p-8 border-white/20 bg-gradient-to-r from-zinc-900/90 via-zinc-950 to-zinc-900/90 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="w-32 h-32 text-white" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-zinc-300 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Workspace Active • {client.company}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, {client.name}
            </h1>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Your centralized collaboration portal. Review deliverables, submit requested compliance assets, and track project milestones.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigateTab('deliverables')}
              leftIcon={<CheckSquare className="w-4 h-4" />}
            >
              Review Deliverables
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigateTab('invoices')}
              leftIcon={<CreditCard className="w-4 h-4" />}
            >
              View Statements
            </Button>
          </div>
        </div>
      </Card>

      {/* Metrics & Quick Attention Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Progress */}
        <Card variant="crystal" className="p-5 border-white/10 bg-zinc-900/50 hover:border-white/20 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider">Overall Progress</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-2xl font-extrabold text-white font-mono">{totalCompletion}%</span>
              <span className="text-xs text-zinc-400 font-mono">{projects.length} Active Project{projects.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden border border-white/5">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-700"
                style={{ width: `${totalCompletion}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Pending Approvals */}
        <Card
          variant="crystal"
          className={`p-5 transition-all cursor-pointer ${
            pendingApprovalsCount > 0 ? 'border-amber-500/30 bg-amber-500/[0.03] hover:border-amber-500/50' : 'border-white/10 bg-zinc-900/50'
          }`}
          onClick={() => onNavigateTab('deliverables')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider">Pending Approvals</span>
            <div className={`p-2 rounded-xl border ${pendingApprovalsCount > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-white/5 border-white/10 text-zinc-400'}`}>
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-white font-mono">{pendingApprovalsCount}</span>
            <p className="text-xs text-zinc-400 mt-1">
              {pendingApprovalsCount > 0 ? 'Deliverables awaiting your sign-off' : 'All deliverables signed off'}
            </p>
          </div>
        </Card>

        {/* Document Requests */}
        <Card
          variant="crystal"
          className={`p-5 transition-all cursor-pointer ${
            pendingDocumentsCount > 0 ? 'border-blue-500/30 bg-blue-500/[0.03] hover:border-blue-500/50' : 'border-white/10 bg-zinc-900/50'
          }`}
          onClick={() => onNavigateTab('documents')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider">Document Requests</span>
            <div className={`p-2 rounded-xl border ${pendingDocumentsCount > 0 ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-white/5 border-white/10 text-zinc-400'}`}>
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-white font-mono">{pendingDocumentsCount}</span>
            <p className="text-xs text-zinc-400 mt-1">
              {pendingDocumentsCount > 0 ? 'Requested files pending upload' : 'All requested assets received'}
            </p>
          </div>
        </Card>

        {/* Outstanding Balance */}
        <Card
          variant="crystal"
          className={`p-5 transition-all cursor-pointer ${
            outstandingInvoicesTotal > 0 ? 'border-indigo-500/30 bg-indigo-500/[0.03] hover:border-indigo-500/50' : 'border-white/10 bg-zinc-900/50'
          }`}
          onClick={() => onNavigateTab('invoices')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider">Outstanding Balance</span>
            <div className={`p-2 rounded-xl border ${outstandingInvoicesTotal > 0 ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-white/5 border-white/10 text-zinc-400'}`}>
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-white font-mono">
              ${outstandingInvoicesTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <p className="text-xs text-zinc-400 mt-1">
              {unpaidInvoices.length > 0 ? `${unpaidInvoices.length} unpaid statement(s)` : 'Account settled in full'}
            </p>
          </div>
        </Card>
      </div>

      {/* Main Grid: Projects & Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Projects & Recent Deliverables */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Projects */}
          <Card variant="crystal">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Active Projects</CardTitle>
                <CardDescription>Real-time status and milestone tracking</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab('projects')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                View All
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">No active projects at present.</div>
              ) : (
                projects.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-zinc-900/60 border border-white/10 space-y-3 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-white tracking-tight">{p.title}</h4>
                        <p className="text-xs text-zinc-400 mt-0.5">{p.description}</p>
                      </div>
                      <StatusPill status={p.status} />
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                        <span>Milestone Progress</span>
                        <span className="font-bold text-white">{p.completionPercentage}%</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-white h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${p.completionPercentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-zinc-400 font-mono">
                      <span>Target Launch: {p.dueDate}</span>
                      <span>Budget: ${p.budget?.toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Deliverables Requiring Sign-Off */}
          <Card variant="crystal">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Deliverables</CardTitle>
                <CardDescription>Files submitted for review and approval</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab('deliverables')}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Go to Deliverables
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {deliverables.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">No deliverables submitted yet.</div>
              ) : (
                deliverables.slice(0, 3).map((del) => (
                  <div
                    key={del.id}
                    className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/20 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{del.title}</span>
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-zinc-300">
                          {del.version}
                        </span>
                        <StatusPill status={del.status} />
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-1">{del.description}</p>
                      <span className="text-[10px] text-zinc-500 font-mono block">Review Deadline: {del.dueDate}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onApproveClick(del)}
                        leftIcon={<CheckSquare className="w-3.5 h-3.5" />}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 Col): Activity & Document Requests */}
        <div className="space-y-6">
          {/* Outstanding File Requests */}
          <Card variant="crystal" className="border-blue-500/20 bg-blue-500/[0.02]">
            <CardHeader>
              <CardTitle className="text-blue-300">Requested Files</CardTitle>
              <CardDescription>Documents requested by your freelancer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingDocs.length === 0 ? (
                <p className="text-xs text-zinc-500 italic py-2">No pending document requests.</p>
              ) : (
                pendingDocs.slice(0, 3).map((doc) => (
                  <div key={doc.id} className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/10 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-bold text-white">{doc.title}</h5>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{doc.type.toUpperCase()} • Requested</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                        Pending Upload
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-center"
                      onClick={() => onUploadClick(doc)}
                      leftIcon={<Upload className="w-3 h-3" />}
                    >
                      Upload File
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Recent Client Activity Feed */}
          <Card variant="crystal">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab('activity')}
                className="text-[11px]"
              >
                View Log
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No activity recorded yet.</p>
              ) : (
                activities.slice(0, 5).map((act) => (
                  <div key={act.id} className="flex items-start gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-400 shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-200 font-medium">{act.title}</p>
                      <p className="text-[11px] text-zinc-400 truncate">{act.description}</p>
                      <span className="text-[10px] font-mono text-zinc-500 block mt-0.5">{act.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
