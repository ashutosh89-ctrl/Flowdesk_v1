import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Input } from '@/frontend/shared/ui/input';
import { Modal } from '@/frontend/shared/ui/modal';
import { useToast } from '@/frontend/shared/ui/toast';
import { FreelancerClientService } from '@/backend/freelancer';
import { Client } from '@/shared/types';
import { projectUpcomingOccurrences } from '@/shared/rules/recurring-rules';
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  XCircle,
  Plus,
  Trash2,
  Calendar,
  Send,
  ShieldCheck,
  Activity,
  ArrowRight,
  Info,
} from 'lucide-react';

interface RecurringSchedule {
  id: string;
  name: string;
  client_id: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  interval_days?: number | null;
  anchor_date: string;
  day_of_month?: number | null;
  next_run_at: string;
  last_run_at?: string | null;
  occurrences_count: number;
  auto_send: boolean;
  due_in_days: number;
  currency: string;
  template: {
    items: { description: string; quantity: number; rate: number }[];
    taxPercentage?: number;
    discount?: number;
  };
}

interface ReminderSettings {
  enabled: boolean;
  send_before_due: boolean;
  days_before_due: number;
  send_on_due_date: boolean;
  send_after_due: boolean;
  days_after_due: number[];
  max_reminders_per_invoice: number;
  quiet_hours_start: string;
  quiet_hours_end: string;
  weekdays_only: boolean;
}

interface JobHealthData {
  lastRunnerRunAt: string | null;
  jobsProcessedLast7Days: number;
  failedLast7Days: number;
  deadJobsCount: number;
  recentDeadJobs: {
    id: string;
    type: string;
    lastError: string | null;
    createdAt: string;
    attempts: number;
  }[];
}

export const AutomationsPanel: React.FC = () => {
  const { showToast } = useToast();

  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    enabled: true,
    send_before_due: true,
    days_before_due: 3,
    send_on_due_date: true,
    send_after_due: true,
    days_after_due: [3, 7, 14],
    max_reminders_per_invoice: 5,
    quiet_hours_start: '20:00',
    quiet_hours_end: '08:00',
    weekdays_only: true,
  });
  const [remindersEntitled, setRemindersEntitled] = useState(true);
  const [jobHealth, setJobHealth] = useState<JobHealthData | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  // New Schedule Form State
  const [newSchedName, setNewSchedName] = useState('');
  const [newSchedClientId, setNewSchedClientId] = useState('');
  const [newSchedFrequency, setNewSchedFrequency] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'>('monthly');
  const [newSchedIntervalDays, setNewSchedIntervalDays] = useState(14);
  const [newSchedAnchorDate, setNewSchedAnchorDate] = useState(new Date().toISOString().split('T')[0]);
  const [newSchedAutoSend, setNewSchedAutoSend] = useState(false);
  const [newSchedDueInDays, setNewSchedDueInDays] = useState(14);
  const [newSchedCurrency, setNewSchedCurrency] = useState('USD');
  const [newSchedItems, setNewSchedItems] = useState<{ description: string; quantity: number; rate: number }[]>([
    { description: 'Monthly Retainer & Ongoing Support', quantity: 1, rate: 2500 },
  ]);

  const loadData = async () => {
    try {
      const clientList = await FreelancerClientService.getClients();
      setClients(clientList);

      const schedRes = await fetch('/api/invoices/recurring');
      if (schedRes.ok) {
        const schedData = await schedRes.json();
        setSchedules(schedData.schedules || []);
      }

      const remRes = await fetch('/api/invoices/reminders/settings');
      if (remRes.ok) {
        const remData = await remRes.json();
        if (remData.settings) {
          setReminderSettings(remData.settings);
        }
        if (remData.entitled !== undefined) {
          setRemindersEntitled(remData.entitled);
        }
      }

      const healthRes = await fetch('/api/jobs/health');
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setJobHealth(healthData.health || null);
      }
    } catch (err: any) {
      console.warn('Error loading automations panel data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const clientList = await FreelancerClientService.getClients();
        if (cancelled) return;
        setClients(clientList);

        const schedRes = await fetch('/api/invoices/recurring');
        if (schedRes.ok && !cancelled) {
          const schedData = await schedRes.json();
          setSchedules(schedData.schedules || []);
        }

        const remRes = await fetch('/api/invoices/reminders/settings');
        if (remRes.ok && !cancelled) {
          const remData = await remRes.json();
          if (remData.settings) {
            setReminderSettings(remData.settings);
          }
          if (remData.entitled !== undefined) {
            setRemindersEntitled(remData.entitled);
          }
        }

        const healthRes = await fetch('/api/jobs/health');
        if (healthRes.ok && !cancelled) {
          const healthData = await healthRes.json();
          setJobHealth(healthData.health || null);
        }
      } catch (err: any) {
        console.warn('Error loading automations panel data:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStatusChange = async (scheduleId: string, action: 'pause' | 'resume' | 'cancel') => {
    setIsActionLoading(scheduleId);
    try {
      const res = await fetch(`/api/invoices/recurring/${scheduleId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Success', `Schedule status updated to ${action}d`, 'success');
        await loadData();
      } else {
        showToast('Error', data.message || 'Failed to update schedule status', 'error');
      }
    } catch {
      showToast('Error', 'Network error updating schedule status', 'error');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleRunNow = async (scheduleId: string) => {
    setIsActionLoading(scheduleId);
    try {
      const res = await fetch(`/api/invoices/recurring/${scheduleId}/run-now`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Generated', 'Current period invoice generated successfully.', 'success');
        await loadData();
      } else {
        showToast('Error', data.message || 'Failed to run recurring schedule', 'error');
      }
    } catch {
      showToast('Error', 'Network error triggering schedule run', 'error');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setIsActionLoading(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Job Retried', 'Job has been reset to queued status.', 'success');
        await loadData();
      } else {
        showToast('Error', data.message || 'Failed to retry job', 'error');
      }
    } catch {
      showToast('Error', 'Network error retrying job', 'error');
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleSaveReminderSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/invoices/reminders/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminderSettings),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Saved', 'Payment reminder preferences updated successfully.', 'success');
      } else {
        showToast('Error', data.message || 'Failed to save reminder settings', 'error');
      }
    } catch {
      showToast('Error', 'Network error saving reminder settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!newSchedName.trim() || !newSchedClientId) {
      showToast('Validation Error', 'Please specify a schedule name and select a client.', 'error');
      return;
    }

    try {
      setIsActionLoading('create');
      const payload = {
        clientId: newSchedClientId,
        name: newSchedName.trim(),
        frequency: newSchedFrequency,
        intervalDays: newSchedFrequency === 'custom' ? newSchedIntervalDays : null,
        anchorDate: newSchedAnchorDate,
        autoSend: newSchedAutoSend,
        dueInDays: newSchedDueInDays,
        currency: newSchedCurrency,
        template: {
          items: newSchedItems,
          taxPercentage: 0,
          discount: 0,
        },
      };

      const res = await fetch('/api/invoices/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Created', 'Recurring invoice schedule created successfully.', 'success');
        setIsCreateModalOpen(false);
        await loadData();
      } else {
        showToast('Error', data.message || 'Failed to create schedule', 'error');
      }
    } catch {
      showToast('Error', 'Network error creating schedule', 'error');
    } finally {
      setIsActionLoading(null);
    }
  };

  // Projected upcoming dates preview for create modal
  const upcomingPreview = projectUpcomingOccurrences(
    {
      frequency: newSchedFrequency,
      intervalDays: newSchedFrequency === 'custom' ? newSchedIntervalDays : null,
      anchorDate: newSchedAnchorDate,
    },
    3,
    new Date()
  );

  return (
    <div className="space-y-8">
      {/* 1. RECURRING INVOICES SECTION */}
      <Card variant="crystal">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
              Recurring Invoice Schedules
            </CardTitle>
            <CardDescription>
              Automate subscription retainers and recurring client billing with idempotent generation.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Schedule
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-400">Loading schedules...</div>
          ) : schedules.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-white/10 rounded-2xl p-8">
              <RefreshCw className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-white">No recurring schedules configured</p>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                Create a recurring invoice schedule to automatically generate drafts or auto-send invoices on a set interval.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setIsCreateModalOpen(true)}
              >
                Create First Schedule
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-400 font-mono">
                    <th className="pb-3 font-medium">Schedule Name</th>
                    <th className="pb-3 font-medium">Frequency</th>
                    <th className="pb-3 font-medium">Next Run</th>
                    <th className="pb-3 font-medium">Occurrences</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {schedules.map((sched) => {
                    const client = clients.find((c) => c.id === sched.client_id);
                    return (
                      <tr key={sched.id} className="hover:bg-white/[0.02]">
                        <td className="py-3">
                          <div className="font-medium text-white">{sched.name}</div>
                          <div className="text-[11px] text-zinc-400">{client?.name || 'Client'}</div>
                        </td>
                        <td className="py-3">
                          <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/5 border border-white/10 text-zinc-300">
                            {sched.frequency}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-zinc-300">
                          {new Date(sched.next_run_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 font-mono text-zinc-400">
                          {sched.occurrences_count} sent
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              sched.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : sched.status === 'paused'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                            }`}
                          >
                            {sched.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {sched.status === 'active' ? (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(sched.id, 'pause')}
                                disabled={isActionLoading === sched.id}
                                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors"
                                title="Pause schedule"
                              >
                                <Pause className="w-3.5 h-3.5" />
                              </button>
                            ) : sched.status === 'paused' ? (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(sched.id, 'resume')}
                                disabled={isActionLoading === sched.id}
                                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                                title="Resume schedule"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            ) : null}

                            {sched.status !== 'cancelled' && sched.status !== 'completed' && (
                              <button
                                type="button"
                                onClick={() => handleRunNow(sched.id)}
                                disabled={isActionLoading === sched.id}
                                className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition-colors"
                                title="Run Now (Generate current invoice)"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {sched.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(sched.id, 'cancel')}
                                disabled={isActionLoading === sched.id}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                                title="Cancel schedule"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. AUTOMATED PAYMENT REMINDERS SECTION */}
      <Card variant="crystal">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-amber-400" />
              Automated Payment Reminders
            </CardTitle>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={reminderSettings.enabled}
                onChange={(e) =>
                  setReminderSettings((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                disabled={!remindersEntitled}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>
          <CardDescription>
            Configure non-intrusive payment notifications sent to clients for unpaid invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!remindersEntitled && (
            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Plan Upgrade Required:</strong> Automated email reminders are available on Pro and Studio plans.
                Free Starter accounts can send unlimited manual reminders per invoice.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Rule 1: Before Due */}
            <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Upcoming Notice</span>
                <input
                  type="checkbox"
                  checked={reminderSettings.send_before_due}
                  onChange={(e) =>
                    setReminderSettings((prev) => ({ ...prev, send_before_due: e.target.checked }))
                  }
                  className="rounded border-zinc-700 text-amber-500"
                />
              </div>
              <p className="text-zinc-400">Courteous notice before due date</p>
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={reminderSettings.days_before_due}
                  onChange={(e) =>
                    setReminderSettings((prev) => ({
                      ...prev,
                      days_before_due: parseInt(e.target.value, 10) || 3,
                    }))
                  }
                  className="w-20 text-xs"
                />
                <span className="text-zinc-400">days prior</span>
              </div>
            </div>

            {/* Rule 2: On Due Date */}
            <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Due Today Notice</span>
                <input
                  type="checkbox"
                  checked={reminderSettings.send_on_due_date}
                  onChange={(e) =>
                    setReminderSettings((prev) => ({ ...prev, send_on_due_date: e.target.checked }))
                  }
                  className="rounded border-zinc-700 text-amber-500"
                />
              </div>
              <p className="text-zinc-400">Polite reminder sent on the exact due date</p>
            </div>

            {/* Rule 3: After Due / Overdue */}
            <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Overdue Escalations</span>
                <input
                  type="checkbox"
                  checked={reminderSettings.send_after_due}
                  onChange={(e) =>
                    setReminderSettings((prev) => ({ ...prev, send_after_due: e.target.checked }))
                  }
                  className="rounded border-zinc-700 text-amber-500"
                />
              </div>
              <p className="text-zinc-400">Dispatched at 3, 7, and 14 days overdue</p>
            </div>

            {/* Quiet Hours & Weekday policy */}
            <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Delivery Window</span>
                <span className="text-zinc-400 font-mono">Weekdays Only</span>
              </div>
              <p className="text-zinc-400">Quiet hours enforced between 20:00 and 08:00 local time</p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={savingSettings}
              onClick={handleSaveReminderSettings}
            >
              Save Reminder Rules
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. JOB RUNNER HEALTH & DEAD-LETTER QUEUE (DLQ) */}
      <Card variant="crystal">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Background Job Engine Health
          </CardTitle>
          <CardDescription>
            Serverless queue execution telemetry and dead-letter queue (DLQ) status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="text-[11px] text-zinc-400 font-mono">Engine Status</div>
              <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5 mt-1">
                <CheckCircle2 className="w-4 h-4" /> Healthy & Active
              </div>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="text-[11px] text-zinc-400 font-mono">Processed (7 Days)</div>
              <div className="text-base font-bold text-white mt-1">
                {jobHealth?.jobsProcessedLast7Days ?? 0} jobs
              </div>
            </div>

            <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="text-[11px] text-zinc-400 font-mono">Dead Letters (DLQ)</div>
              <div className="text-base font-bold text-white mt-1 flex items-center gap-1.5">
                {(jobHealth?.deadJobsCount ?? 0) > 0 ? (
                  <span className="text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> {jobHealth?.deadJobsCount} Dead
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" /> 0 Dead
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Dead Jobs Table */}
          {jobHealth && jobHealth.recentDeadJobs && jobHealth.recentDeadJobs.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Unresolved Dead Letters
              </h4>
              <div className="overflow-x-auto border border-rose-500/20 rounded-xl bg-rose-500/[0.03]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-rose-500/10 text-zinc-400 font-mono">
                      <th className="p-3 font-medium">Job Type</th>
                      <th className="p-3 font-medium">Last Error</th>
                      <th className="p-3 font-medium">Attempts</th>
                      <th className="p-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-500/10">
                    {jobHealth.recentDeadJobs.map((dj) => (
                      <tr key={dj.id}>
                        <td className="p-3 font-mono text-white">{dj.type}</td>
                        <td className="p-3 text-rose-300 max-w-xs truncate">{dj.lastError || 'Unknown error'}</td>
                        <td className="p-3 font-mono text-zinc-400">{dj.attempts}</td>
                        <td className="p-3 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            isLoading={isActionLoading === dj.id}
                            onClick={() => handleRetryJob(dj.id)}
                          >
                            Retry
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE RECURRING SCHEDULE MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Recurring Invoice Schedule"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block text-zinc-400 font-medium mb-1">Schedule Name</label>
            <Input
              type="text"
              placeholder="e.g. Acme Corp Monthly Retainer"
              value={newSchedName}
              onChange={(e) => setNewSchedName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Client</label>
              <select
                value={newSchedClientId}
                onChange={(e) => setNewSchedClientId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs"
              >
                <option value="">Select client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Frequency</label>
              <select
                value={newSchedFrequency}
                onChange={(e) => setNewSchedFrequency(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-white/10 bg-zinc-900 text-white text-xs"
              >
                <option value="weekly">Weekly (+7 days)</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly (+3 months)</option>
                <option value="yearly">Yearly (+1 year)</option>
                <option value="custom">Custom Interval</option>
              </select>
            </div>
          </div>

          {newSchedFrequency === 'custom' && (
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Interval Days</label>
              <Input
                type="number"
                min={1}
                max={365}
                value={newSchedIntervalDays}
                onChange={(e) => setNewSchedIntervalDays(parseInt(e.target.value, 10) || 14)}
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Anchor Date</label>
              <Input
                type="date"
                value={newSchedAnchorDate}
                onChange={(e) => setNewSchedAnchorDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Payment Due In</label>
              <Input
                type="number"
                min={0}
                max={90}
                value={newSchedDueInDays}
                onChange={(e) => setNewSchedDueInDays(parseInt(e.target.value, 10) || 14)}
              />
            </div>

            <div>
              <label className="block text-zinc-400 font-medium mb-1">Currency</label>
              <Input
                type="text"
                value={newSchedCurrency}
                onChange={(e) => setNewSchedCurrency(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newSchedAutoSend}
                onChange={(e) => setNewSchedAutoSend(e.target.checked)}
                className="rounded border-zinc-700 text-emerald-500"
              />
              <span className="text-white font-medium">Auto-send to client via email immediately upon generation</span>
            </label>
          </div>

          {/* Line Items */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Line Items</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setNewSchedItems((prev) => [
                    ...prev,
                    { description: 'Additional Services', quantity: 1, rate: 500 },
                  ])
                }
              >
                + Add Item
              </Button>
            </div>

            {newSchedItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => {
                    const desc = e.target.value;
                    setNewSchedItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, description: desc } : it))
                    );
                  }}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => {
                    const qty = parseInt(e.target.value, 10) || 1;
                    setNewSchedItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, quantity: qty } : it))
                    );
                  }}
                  className="w-16"
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Rate"
                  value={item.rate}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value) || 0;
                    setNewSchedItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, rate } : it))
                    );
                  }}
                  className="w-24"
                />
                {newSchedItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setNewSchedItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Upcoming Projected Runs Preview */}
          <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] space-y-2 mt-4">
            <span className="font-semibold text-zinc-300 block">Upcoming Occurrences Projection:</span>
            <div className="space-y-1 font-mono text-[11px] text-zinc-400">
              {upcomingPreview.map((occ, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span>Occurrence #{idx + 1}: {occ.runAt.toLocaleDateString()}</span>
                  <span className="text-zinc-500">Period: {occ.periodKey}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-white/10">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isActionLoading === 'create'}
              onClick={handleCreateSchedule}
            >
              Create Schedule
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
