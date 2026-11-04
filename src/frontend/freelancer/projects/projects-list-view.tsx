import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Input } from '@/frontend/shared/ui/input';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { Progress } from '@/frontend/shared/ui/progress';
import { Modal } from '@/frontend/shared/ui/modal';
import { CreateProjectModal } from './components/create-project-modal';
import { ProjectService, ClientService } from '@/backend/freelancer';
import { Project, Client, ProjectMilestone } from '@/shared/types';
import {
  Plus,
  FolderKanban,
  Search,
  Calendar,
  DollarSign,
  Tag,
  CheckCircle2,
  Circle,
  ArrowUpRight,
  MoreVertical,
  Check,
} from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';
import { useAuth } from '@/frontend/auth/auth-context';
import { formatCurrency, getCurrencySymbol } from '@/shared/utils/currency';
import { UserSettingsService } from '@/backend/auth/user-settings-service';
import { UserSettings } from '@/shared/types';

export interface ProjectsListViewProps {
  onOpenWorkspace?: (clientId: string) => void;
}

export const ProjectsListView: React.FC<ProjectsListViewProps> = ({ onOpenWorkspace }) => {
  const { profile, userSettings } = useAuth();
  const [activeCurrency, setActiveCurrency] = useState<string>(() => {
    return userSettings?.currency || profile?.currency || UserSettingsService.getLocalSettings('usr-default')?.currency || 'INR';
  });

  useEffect(() => {
    const cur = userSettings?.currency || profile?.currency;
    if (cur) setActiveCurrency(cur);
  }, [userSettings?.currency, profile?.currency]);

  useEffect(() => {
    const handleSettingsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<UserSettings>;
      if (customEvent.detail?.currency) {
        setActiveCurrency(customEvent.detail.currency);
      }
    };
    window.addEventListener('flowdesk:settings-updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('flowdesk:settings-updated', handleSettingsUpdated);
    };
  }, []);

  const studioCurrency = activeCurrency || 'INR';
  const currencySymbol = getCurrencySymbol(studioCurrency);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'dueDate' | 'budget' | 'completionPercentage'>('dueDate');

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const { showToast } = useToast();

  const loadData = React.useCallback(() => {
    ProjectService.getProjects().then(setProjects);
    ClientService.getClients().then((cls) => {
      setClients(cls);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleMilestone = (milestoneId: string) => {
    if (!detailProject) return;
    ProjectService.toggleMilestone(detailProject.id, milestoneId).then((updated) => {
      if (updated) {
        setDetailProject({ ...updated });
        loadData();
      }
    });
  };

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailProject || !newMilestoneTitle.trim()) return;
    ProjectService.addMilestone(detailProject.id, newMilestoneTitle, detailProject.dueDate).then((updated) => {
      if (updated) {
        setDetailProject({ ...updated });
        setNewMilestoneTitle('');
        showToast('Milestone Added', `Milestone added to ${detailProject.title}.`, 'success');
        loadData();
      }
    });
  };

  const handleMarkComplete = (projId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    ProjectService.markProjectComplete(projId).then(() => {
      showToast('Project Completed', 'Project marked as 100% complete.', 'success');
      if (detailProject?.id === projId) setDetailProject(null);
      loadData();
    });
  };

  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.clientName.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (sortBy === 'dueDate') return a.dueDate.localeCompare(b.dueDate);
    if (sortBy === 'budget') return b.budget - a.budget;
    return b.completionPercentage - a.completionPercentage;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Projects</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Track active project budgets, completion percentages, and client milestones.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
          New Project
        </Button>
      </div>

      {/* Filter & Sort Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="w-full lg:w-80">
          <Input
            type="search"
            placeholder="Search projects or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter pills */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900/60 border border-white/10 rounded-xl">
            {['all', 'in_progress', 'review', 'completed', 'on_hold'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                  statusFilter === st ? 'bg-white text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-400">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="dueDate" className="bg-zinc-900">Due Date</option>
              <option value="budget" className="bg-zinc-900">Budget</option>
              <option value="completionPercentage" className="bg-zinc-900">Completion %</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedProjects.length === 0 ? (
          <p className="text-xs text-zinc-400 italic col-span-2 py-8 text-center">
            No projects found matching your search filters.
          </p>
        ) : (
          sortedProjects.map((p) => (
            <Card
              key={p.id}
              variant="crystal"
              interactive
              onClick={() => setDetailProject(p)}
              className="flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenWorkspace) onOpenWorkspace(p.clientId);
                    }}
                    className="text-xs font-bold text-zinc-400 hover:text-white uppercase font-mono cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    {p.clientName} <ArrowUpRight className="w-3 h-3 text-zinc-500" />
                  </span>
                  <StatusPill status={p.status} />
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-white">{p.title}</h3>
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{p.description}</p>

                {/* Progress Meter */}
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs text-zinc-400 font-medium font-mono">
                    <span>Progress</span>
                    <span className="text-white font-bold">{p.completionPercentage}%</span>
                  </div>
                  <Progress value={p.completionPercentage} size="sm" />
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1 font-mono text-white font-bold">
                  {(() => {
                    const projectClient = clients.find((c) => c.id === p.clientId);
                    const projectCurrency = projectClient?.currency || studioCurrency;
                    return formatCurrency(p.budget, projectCurrency);
                  })()}
                </span>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 font-mono text-zinc-400">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" /> {p.dueDate}
                  </span>
                  {p.status !== 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleMarkComplete(p.id, e)}
                      title="Mark as complete"
                      leftIcon={<Check className="w-3.5 h-3.5" />}
                    >
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Full Detailed Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        clients={clients}
        onSuccess={() => loadData()}
      />

      {/* Project Detail & Milestones Modal */}
      <Modal isOpen={!!detailProject} onClose={() => setDetailProject(null)} title={detailProject?.title || 'Project Details'}>
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-950 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono text-zinc-400 uppercase">{detailProject?.clientName}</span>
                <h3 className="text-lg font-bold text-white">{detailProject?.title}</h3>
              </div>
              <StatusPill status={detailProject?.status || 'in_progress'} />
            </div>

            <p className="text-xs text-zinc-300">{detailProject?.description}</p>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400 font-mono">
                <span>Overall Completion</span>
                <span className="text-white font-bold">{detailProject?.completionPercentage}%</span>
              </div>
              <Progress value={detailProject?.completionPercentage || 0} size="sm" />
            </div>

            {/* Milestones Checklist */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <h4 className="text-xs font-bold text-white font-mono uppercase">Project Milestones</h4>

              <div className="space-y-2">
                {detailProject?.milestones?.map((ms) => (
                  <div
                    key={ms.id}
                    onClick={() => handleToggleMilestone(ms.id)}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/15 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          ms.completed ? 'bg-white text-zinc-950 border-white' : 'border-zinc-600'
                        }`}
                      >
                        {ms.completed && <Check className="w-3 h-3 text-zinc-950" />}
                      </div>
                      <span className={ms.completed ? 'line-through text-zinc-500' : 'text-white font-semibold'}>
                        {ms.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">Due {ms.dueDate}</span>
                  </div>
                ))}
              </div>

              {/* Add Milestone Form */}
              <form onSubmit={handleAddMilestone} className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Add new milestone..."
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
                />
                <Button type="submit" variant="secondary" size="sm">
                  Add
                </Button>
              </form>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {detailProject?.clientId && onOpenWorkspace && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onOpenWorkspace(detailProject.clientId);
                  setDetailProject(null);
                }}
                rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
              >
                Open Client Workspace
              </Button>
            )}

            <div className="flex items-center gap-3 ml-auto">
              <Button variant="ghost" onClick={() => setDetailProject(null)}>
                Close
              </Button>
              {detailProject?.status !== 'completed' && (
                <Button
                  variant="primary"
                  onClick={() => detailProject && handleMarkComplete(detailProject.id)}
                  leftIcon={<Check className="w-3.5 h-3.5" />}
                >
                  Mark Complete
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
