'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import {
  DashboardService,
  InvoiceService,
  ClientService,
  ProjectService,
  DeliverableService,
  TaskService,
} from '@/backend/freelancer';
import { formatCurrency } from '@/shared/utils/currency';
import { useToast } from '@/frontend/shared/ui/toast';
import {
  BarChart3,
  Download,
  TrendingUp,
  Receipt,
  Users,
  FolderKanban,
  CheckCircle2,
  Clock,
  CheckSquare,
  Loader2,
  Calendar,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [m, invs, clis, projs, dels, tsks] = await Promise.all([
          DashboardService.getMetrics(),
          InvoiceService.getInvoices(),
          ClientService.getClients(),
          ProjectService.getProjects(),
          DeliverableService.getDeliverables(),
          TaskService.getTasks(),
        ]);
        setMetrics(m);
        setInvoices(invs || []);
        setClients(clis || []);
        setProjects(projs || []);
        setDeliverables(dels || []);
        setTasks(tsks || []);
      } catch {
        showToast('Error', 'Failed to calculate analytics.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Export Complete', `Downloaded ${filename}`, 'success');
  };

  const exportInvoicesCsv = () => {
    const headers = ['Invoice Number', 'Client Name', 'Status', 'Issue Date', 'Due Date', 'Subtotal', 'Tax', 'Total Amount', 'Currency'];
    const rows = invoices.map((inv) => [
      inv.invoiceNumber || inv.invoice_number,
      inv.clientName || inv.client_name || 'Client',
      inv.status || 'pending',
      inv.issueDate || inv.issue_date || '',
      inv.dueDate || inv.due_date || '',
      inv.subtotal || 0,
      inv.taxAmount || inv.tax_amount || 0,
      inv.total || inv.total_amount || 0,
      inv.currency || 'INR',
    ]);
    downloadCsv(`flowdesk_invoices_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const exportClientsCsv = () => {
    const headers = ['Client ID', 'Client Name', 'Company', 'Email', 'Phone', 'Status', 'Country'];
    const rows = clients.map((c) => [
      c.id,
      c.name,
      c.company || '',
      c.email || '',
      c.phone || '',
      c.status || 'active',
      c.country || '',
    ]);
    downloadCsv(`flowdesk_clients_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const exportProjectsCsv = () => {
    const headers = ['Project Title', 'Client Name', 'Status', 'Budget', 'Spent', 'Completion %', 'Start Date', 'Due Date'];
    const rows = projects.map((p) => [
      p.title,
      p.clientName || '',
      p.status || 'in_progress',
      p.budget || 0,
      p.spent || 0,
      `${p.completionPercentage || 0}%`,
      p.startDate || '',
      p.dueDate || '',
    ]);
    downloadCsv(`flowdesk_projects_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  const exportTasksCsv = () => {
    const headers = ['Task Title', 'Status', 'Priority', 'Due Date', 'Description'];
    const rows = tasks.map((t) => [
      t.title,
      t.status || 'todo',
      t.priority || 'medium',
      t.dueDate || '',
      t.description || '',
    ]);
    downloadCsv(`flowdesk_tasks_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  };

  // Financial calculations
  const totalBilled = invoices.reduce((sum, inv) => sum + (Number(inv.total) || Number(inv.total_amount) || 0), 0);
  const totalPaid = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + (Number(inv.total) || Number(inv.total_amount) || 0), 0);
  const totalPending = invoices
    .filter((inv) => inv.status !== 'paid')
    .reduce((sum, inv) => sum + (Number(inv.total) || Number(inv.total_amount) || 0), 0);
  const overdueCount = invoices.filter((inv) => inv.status === 'overdue').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#43D6B0]" />
        <p className="text-sm">Compiling operational analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#43D6B0]" />
            Reports &amp; Financial Analytics
          </h2>
          <p className="text-sm text-zinc-400">
            Real-time business performance metrics, settlement velocity, and complete data exports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={exportInvoicesCsv}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export Invoices CSV
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={exportClientsCsv}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export Clients CSV
          </Button>
        </div>
      </div>

      {/* Financial Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="crystal" className="p-4 space-y-1">
          <span className="text-xs font-mono text-zinc-400">Total Invoiced (All-Time)</span>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(totalBilled, 'INR')}
          </div>
          <span className="text-[11px] text-zinc-500 font-mono block">Across {invoices.length} total invoices</span>
        </Card>

        <Card variant="crystal" className="p-4 space-y-1 border-emerald-500/20 bg-emerald-500/[0.02]">
          <span className="text-xs font-mono text-emerald-400">Settled Revenue</span>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(totalPaid, 'INR')}
          </div>
          <span className="text-[11px] text-emerald-400/80 font-mono block">Paid and verified</span>
        </Card>

        <Card variant="crystal" className="p-4 space-y-1 border-amber-500/20 bg-amber-500/[0.02]">
          <span className="text-xs font-mono text-amber-400">Outstanding Receivable</span>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatCurrency(totalPending, 'INR')}
          </div>
          <span className="text-[11px] text-amber-400/80 font-mono block">
            {overdueCount > 0 ? `${overdueCount} overdue invoices` : 'All invoices within due date'}
          </span>
        </Card>

        <Card variant="crystal" className="p-4 space-y-1 border-sky-500/20 bg-sky-500/[0.02]">
          <span className="text-xs font-mono text-sky-400">Deliverable Approvals</span>
          <div className="text-2xl font-bold text-white tracking-tight">
            {deliverables.filter((d) => d.status === 'approved').length} / {deliverables.length}
          </div>
          <span className="text-[11px] text-sky-400/80 font-mono block">
            {deliverables.length > 0
              ? `${Math.round((deliverables.filter((d) => d.status === 'approved').length / deliverables.length) * 100)}% approval rate`
              : 'No deliverables yet'}
          </span>
        </Card>
      </div>

      {/* Breakdown Details & Data Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Velocity Breakdown */}
        <Card variant="crystal">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-[#43D6B0]" />
              Active Project Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.length === 0 ? (
              <p className="text-xs text-zinc-500">No active projects found.</p>
            ) : (
              projects.slice(0, 5).map((p) => (
                <div key={p.id} className="p-3 bg-white/[0.02] border border-white/10 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{p.title}</span>
                    <span className="font-mono text-[#43D6B0]">{p.completionPercentage || 0}%</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#43D6B0] h-full rounded-full transition-all duration-300"
                      style={{ width: `${p.completionPercentage || 0}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                    <span>Budget: {formatCurrency(p.budget || 0, 'INR')}</span>
                    <span>Client: {p.clientName || 'General'}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Data Export Center */}
        <Card variant="crystal">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="w-4 h-4 text-[#43D6B0]" />
              Data Export &amp; Backup Center
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Export your structured records in standard CSV format for accounting, spreadsheet modeling, or tax filing.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={exportInvoicesCsv}
                className="justify-start text-xs"
                leftIcon={<Receipt className="w-4 h-4 text-[#43D6B0]" />}
              >
                Invoices CSV ({invoices.length})
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={exportClientsCsv}
                className="justify-start text-xs"
                leftIcon={<Users className="w-4 h-4 text-[#43D6B0]" />}
              >
                Clients CSV ({clients.length})
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={exportProjectsCsv}
                className="justify-start text-xs"
                leftIcon={<FolderKanban className="w-4 h-4 text-[#43D6B0]" />}
              >
                Projects CSV ({projects.length})
              </Button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={exportTasksCsv}
                className="justify-start text-xs"
                leftIcon={<CheckSquare className="w-4 h-4 text-[#43D6B0]" />}
              >
                Tasks CSV ({tasks.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

