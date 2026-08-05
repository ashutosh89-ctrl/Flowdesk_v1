import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import { Progress } from '../../../components/ui/progress';
import { WorkspaceSummary } from '../../../types';
import { WorkspaceProgressService, WorkspaceHealthService } from '../../../services';
import {
  Activity,
  ShieldCheck,
  FileText,
  CheckCircle2,
  DollarSign,
  ArrowRight,
  Clock,
  Sparkles,
  Zap,
  AlertTriangle,
  Layers,
} from 'lucide-react';

export interface OverviewTabProps {
  summary: WorkspaceSummary;
  onRefresh: () => void;
  onTabChange: (tabId: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ summary, onRefresh, onTabChange }) => {
  const { client, projects, deliverables, documents, invoices, activities } = summary;

  // Compute calculated Progress & Health details
  const progressBreakdown = WorkspaceProgressService.calculateProgressBreakdown(summary);
  const healthDetails = WorkspaceHealthService.evaluateWorkspaceHealth(summary);

  const outstandingTotal = invoices
    .filter((i) => i.status === 'pending' || i.status === 'overdue')
    .reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="crystal">
          <span className="text-xs text-zinc-400 uppercase font-mono">Workspace Health</span>
          <div className="flex items-center justify-between mt-1">
            <p className="text-2xl font-bold text-white">{healthDetails.score} / 100</p>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                healthDetails.status === 'Healthy' || healthDetails.status === 'Completed'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : healthDetails.status === 'Blocked'
                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              {healthDetails.status}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Diagnosis Active
          </p>
        </Card>

        <Card variant="crystal">
          <span className="text-xs text-zinc-400 uppercase font-mono">Overall Completion</span>
          <p className="text-2xl font-bold text-white mt-1">{progressBreakdown.overallPercentage}%</p>
          <div className="mt-2">
            <Progress value={progressBreakdown.overallPercentage} size="sm" />
          </div>
        </Card>

        <Card variant="crystal">
          <span className="text-xs text-zinc-400 uppercase font-mono">Total Billed</span>
          <p className="text-2xl font-bold text-white mt-1">
            ${client.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-zinc-400 mt-1">{client.currency} Account</p>
        </Card>

        <Card variant="crystal">
          <span className="text-xs text-zinc-400 uppercase font-mono">Outstanding Balance</span>
          <p className="text-2xl font-bold text-white mt-1">
            ${outstandingTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-zinc-400 mt-1">Due invoices</p>
        </Card>
      </div>

      {/* Health Warnings & Diagnostics Banner */}
      {healthDetails.reasons.length > 0 && (
        <Card variant="crystal" className="p-4 border-amber-500/20 bg-amber-500/[0.03] space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-mono uppercase">
            <AlertTriangle className="w-4 h-4" /> Workspace Health Diagnostics
          </div>
          <ul className="list-disc list-inside text-xs text-zinc-300 space-y-1">
            {healthDetails.reasons.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Weighted Progress Engine Breakdown */}
      <Card variant="crystal">
        <CardHeader>
          <CardTitle className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-4 h-4 text-white" />
            Weighted Workspace Progress Engine
          </CardTitle>
          <CardDescription>
            Documents (20%), Project Milestones (30%), Deliverables (30%), Sign-Off Approvals (20%)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-white/10 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-400">Documents Verified</span>
              <span className="text-white font-bold">{progressBreakdown.documentsPercentage}%</span>
            </div>
            <Progress value={progressBreakdown.documentsPercentage} size="sm" />
            <span className="text-[10px] text-zinc-500 font-mono block">Weight: 20%</span>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-white/10 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-400">Milestones Done</span>
              <span className="text-white font-bold">{progressBreakdown.milestonesPercentage}%</span>
            </div>
            <Progress value={progressBreakdown.milestonesPercentage} size="sm" />
            <span className="text-[10px] text-zinc-500 font-mono block">Weight: 30%</span>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-white/10 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-400">Deliverables Submitted</span>
              <span className="text-white font-bold">{progressBreakdown.deliverablesPercentage}%</span>
            </div>
            <Progress value={progressBreakdown.deliverablesPercentage} size="sm" />
            <span className="text-[10px] text-zinc-500 font-mono block">Weight: 30%</span>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-white/10 space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-400">Client Approvals</span>
              <span className="text-white font-bold">{progressBreakdown.approvalsPercentage}%</span>
            </div>
            <Progress value={progressBreakdown.approvalsPercentage} size="sm" />
            <span className="text-[10px] text-zinc-500 font-mono block">Weight: 20%</span>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Action Card for Client */}
      <Card variant="crystal" className="p-5 border-white/20 bg-white/[0.02]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-white text-zinc-950 font-bold shrink-0">
              <Zap className="w-5 h-5 text-zinc-950" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-zinc-400">RECOMMENDED ACTION</span>
              <h4 className="text-sm font-bold text-white mt-0.5">
                {deliverables.some((d) => d.status === 'in_review')
                  ? 'Follow up on Deliverable Review'
                  : 'Verify Required Client Documents'}
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                {deliverables.some((d) => d.status === 'in_review')
                  ? 'Deliverable is waiting for client feedback or sign-off.'
                  : 'Check documents repository to confirm NDA & tax forms.'}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onTabChange(deliverables.some((d) => d.status === 'in_review') ? 'deliverables' : 'documents')}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Open Tab
          </Button>
        </div>
      </Card>

      {/* Main Overview Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects & Progress Bars */}
        <div className="lg:col-span-2 space-y-6">
          <Card variant="crystal">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Projects & Milestones</CardTitle>
                  <CardDescription>Current milestones and progress</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.length === 0 ? (
                <p className="text-xs text-zinc-400 italic">No active projects assigned yet.</p>
              ) : (
                projects.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl bg-zinc-900/50 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white">{p.title}</h4>
                      <StatusPill status={p.status} />
                    </div>
                    <p className="text-xs text-zinc-400">{p.description}</p>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>Completion Rate</span>
                        <span className="text-white font-bold font-mono">{p.completionPercentage}%</span>
                      </div>
                      <Progress value={p.completionPercentage} size="sm" />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 pt-2 border-t border-white/5 font-mono">
                      <span>Budget: <strong className="text-white">${p.budget.toLocaleString()}</strong></span>
                      <span>Due: <strong className="text-white">{p.dueDate}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Repository Completion Progress Meters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card variant="crystal">
              <span className="text-xs text-zinc-400 uppercase font-mono">Documents Progress</span>
              <div className="flex items-center justify-between my-2">
                <span className="text-lg font-bold text-white">
                  {documents.filter((d) => d.status === 'verified' || d.status === 'signed').length} / {documents.length} verified
                </span>
                <span className="text-xs font-mono text-zinc-400">{progressBreakdown.documentsPercentage}%</span>
              </div>
              <Progress value={progressBreakdown.documentsPercentage} size="sm" />
            </Card>

            <Card variant="crystal">
              <span className="text-xs text-zinc-400 uppercase font-mono">Deliverables Progress</span>
              <div className="flex items-center justify-between my-2">
                <span className="text-lg font-bold text-white">
                  {deliverables.filter((d) => d.status === 'approved').length} / {deliverables.length} approved
                </span>
                <span className="text-xs font-mono text-zinc-400">{progressBreakdown.deliverablesPercentage}%</span>
              </div>
              <Progress value={progressBreakdown.deliverablesPercentage} size="sm" />
            </Card>
          </div>
        </div>

        {/* Client Profile Details & Activity Log */}
        <div className="space-y-6">
          <Card variant="crystal">
            <CardHeader>
              <CardTitle>Client Account Profile</CardTitle>
              <CardDescription>Contact info & workspace notes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <span className="text-zinc-500 uppercase font-mono text-[10px]">Contact Person</span>
                <p className="text-white font-semibold">{client.name}</p>
                <p className="text-zinc-400">{client.email}</p>
              </div>
              <div>
                <span className="text-zinc-500 uppercase font-mono text-[10px]">Country & Currency</span>
                <p className="text-white font-semibold">{client.country} ({client.currency})</p>
              </div>
              <div>
                <span className="text-zinc-500 uppercase font-mono text-[10px]">Workspace Notes</span>
                <p className="text-zinc-300 mt-1 p-2.5 rounded-lg bg-zinc-900 border border-white/5">
                  {client.notes || 'No notes added yet.'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Client Activity feed */}
          <Card variant="crystal">
            <CardHeader>
              <CardTitle className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Recent Client Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {activities.length === 0 ? (
                <p className="text-zinc-500 italic text-[11px]">No activity logged yet.</p>
              ) : (
                activities.slice(0, 3).map((act) => (
                  <div key={act.id} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-white font-semibold">{act.user}</span>{' '}
                    <span className="text-zinc-400">{act.action}</span>{' '}
                    <span className="text-white font-mono">{act.target}</span>
                    <span className="block text-[10px] text-zinc-500 font-mono mt-1">{act.timestamp}</span>
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
