import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StatusPill } from '../../components/ui/status-pill';
import { Avatar } from '../../components/ui/avatar';
import {
  DashboardService,
  InvoiceService,
  ClientService,
  ProjectService,
  ActivityService,
  SettingsService,
} from '../../services';
import { DashboardMetrics, Invoice, Client, Project, ActivityLog, UserProfile } from '../../types';
import {
  DollarSign,
  Users,
  Clock,
  AlertCircle,
  ArrowUpRight,
  Plus,
  FileText,
  CheckCircle2,
  FolderKanban,
  Sparkles,
  Zap,
  Calendar,
  Activity,
} from 'lucide-react';

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
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    DashboardService.getMetrics().then(setMetrics);
    InvoiceService.getInvoices().then((invs) => setInvoices(invs.slice(0, 4)));
    ClientService.getClients().then((clis) => setClients(clis.slice(0, 4)));
    ProjectService.getProjects().then((projs) => setProjects(projs));
    ActivityService.getActivities().then((acts) => setActivities(acts.slice(0, 5)));
    SettingsService.getUserProfile().then(setUserProfile);
  }, []);

  if (!metrics) return null;

  const greetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const upcomingProjects = projects.filter((p) => p.status !== 'completed').slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Dashboard Top Greeting & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {greetingTime()}, {userProfile?.name || 'Alex'}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Mission Control for {userProfile?.companyName || 'Rivera Studio'} • All systems operational.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => onNavigate('projects')} leftIcon={<FolderKanban className="w-4 h-4" />}>
            Projects
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onNavigate('invoices')} leftIcon={<FileText className="w-4 h-4" />}>
            Invoices
          </Button>
          <Button variant="primary" size="sm" onClick={onQuickAction} leftIcon={<Plus className="w-4 h-4" />}>
            New Client
          </Button>
        </div>
      </div>

      {/* Next Best Action Banner Card */}
      <Card variant="crystal" className="relative overflow-hidden border-white/20 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white text-zinc-950 flex items-center justify-center shrink-0 shadow-lg font-bold">
              <Sparkles className="w-6 h-6 text-zinc-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 bg-white/10 px-2 py-0.5 rounded-full border border-white/15">
                  RECOMMENDED ACTION
                </span>
                <span className="text-xs text-zinc-400 font-mono">• Monolith Ventures</span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Send Outstanding Invoice #INV-2026-002 ($16,000.00)
              </h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                Brand Strategy Phase 1 is complete. Request settlement or send a magic portal reminder to Marcus Sterling.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate('invoices')}
              rightIcon={<Zap className="w-4 h-4" />}
            >
              Take Action Now
            </Button>
          </div>
        </div>
      </Card>

      {/* Core Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="crystal" interactive className="p-5 group">
          <div className="flex items-center justify-between text-zinc-400 text-xs uppercase tracking-widest font-mono font-semibold">
            <span>Total Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white group-hover:bg-white group-hover:text-zinc-950 transition-colors">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white tracking-tight mt-3">
            ${metrics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <div className="text-[11px] text-zinc-400 mt-2 flex items-center gap-1.5 font-mono">
            <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              +18.4%
            </span>
            <span>lifetime billed</span>
          </div>
        </Card>

        <Card variant="crystal" interactive className="p-5 group">
          <div className="flex items-center justify-between text-zinc-400 text-xs uppercase tracking-widest font-mono font-semibold">
            <span>Active Clients</span>
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white group-hover:bg-white group-hover:text-zinc-950 transition-colors">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white tracking-tight mt-3">{metrics.activeClientsCount}</p>
          <p className="text-[11px] text-zinc-400 mt-2 font-mono">Healthy client hubs</p>
        </Card>

        <Card variant="crystal" interactive className="p-5 group">
          <div className="flex items-center justify-between text-zinc-400 text-xs uppercase tracking-widest font-mono font-semibold">
            <span>Pending Invoices</span>
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white group-hover:bg-white group-hover:text-zinc-950 transition-colors">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white tracking-tight mt-3">
            ${metrics.pendingInvoicesAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-zinc-400 mt-2 font-mono">Outstanding settlement</p>
        </Card>

        <Card variant="crystal" interactive className="p-5 group">
          <div className="flex items-center justify-between text-zinc-400 text-xs uppercase tracking-widest font-mono font-semibold">
            <span>Pending Deliverables</span>
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white group-hover:bg-white group-hover:text-zinc-950 transition-colors">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white tracking-tight mt-3">{metrics.upcomingDeliverablesCount}</p>
          <p className="text-[11px] text-zinc-400 mt-2 font-mono">Awaiting client sign-off</p>
        </Card>
      </div>

      {/* Main Grid: Revenue & Deadlines / Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Analytics Chart */}
        <Card variant="crystal" className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Revenue & Cashflow Analytics</CardTitle>
                <CardDescription>6-Month revenue trajectory</CardDescription>
              </div>
              <span className="text-xs font-mono font-bold text-white px-2.5 py-1 rounded-full bg-white/10 border border-white/15">
                FY 2026
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end justify-between gap-3 pt-6 pb-2">
              {metrics.revenueHistory.map((item, idx) => {
                const maxVal = 30000;
                const heightPct = Math.round((item.amount / maxVal) * 100);
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                    <span className="text-[10px] text-zinc-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                      ${(item.amount / 1000).toFixed(1)}k
                    </span>
                    <div className="w-full bg-zinc-900/80 rounded-xl h-36 flex items-end p-1 border border-white/5">
                      <div
                        className="w-full bg-white rounded-lg transition-all duration-500 group-hover:bg-zinc-200"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-zinc-400">{item.month}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Client Workspaces Shortcut */}
        <Card variant="crystal">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Client Workspaces</CardTitle>
              <button
                onClick={() => onNavigate('clients')}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                View all
              </button>
            </div>
            <CardDescription>Active client hubs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {clients.map((cli) => (
              <div
                key={cli.id}
                onClick={() => onOpenClientWorkspace(cli.id)}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 hover:bg-white/[0.08] transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={cli.name} src={cli.avatarUrl} size="sm" />
                  <div>
                    <h5 className="text-xs font-bold text-white">{cli.company}</h5>
                    <p className="text-[10px] text-zinc-400">{cli.name}</p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid: Upcoming Deadlines & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Deadlines */}
        <Card variant="crystal">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-white" /> Upcoming Deadlines
                </CardTitle>
                <CardDescription>Deliverables and project target dates</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('projects')}>
                Projects Engine
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingProjects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => onNavigate('projects')}
                className="p-3.5 rounded-xl bg-zinc-900/50 border border-white/10 hover:border-white/20 cursor-pointer transition-all flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                      {proj.clientName}
                    </span>
                    <StatusPill status={proj.status} />
                  </div>
                  <h4 className="text-xs font-bold text-white mt-1.5">{proj.title}</h4>
                </div>
                <div className="text-right font-mono text-xs">
                  <span className="text-zinc-400 block text-[10px]">DUE</span>
                  <span className="text-white font-bold">{proj.dueDate}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Real-time Audit Trail */}
        <Card variant="crystal">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-white" /> Audit & Activity Trail
                </CardTitle>
                <CardDescription>Chronological event log</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('activity')}>
                Full Feed
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activities.map((act) => (
              <div key={act.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-white mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{act.user}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{act.timestamp}</span>
                  </div>
                  <p className="text-zinc-400 mt-0.5">
                    {act.action} <strong className="text-white">{act.target}</strong>
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
