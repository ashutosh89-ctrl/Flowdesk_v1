import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Input } from '@/frontend/shared/ui/input';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { Progress } from '@/frontend/shared/ui/progress';
import { Modal } from '@/frontend/shared/ui/modal';
import { WorkspaceSummary, Project, ProjectMilestone } from '@/shared/types';
import { ProjectService } from '@/backend/freelancer';
import { useToast } from '@/frontend/shared/ui/toast';
import {
  FolderKanban,
  Plus,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Receipt,
  Layers,
  ChevronRight,
  CheckSquare,
  Square,
  Tag,
  Flag,
} from 'lucide-react';

export interface ProjectsTabProps {
  summary: WorkspaceSummary;
  onRefresh: () => void;
}

export const ProjectsTab: React.FC<ProjectsTabProps> = ({ summary, onRefresh }) => {
  const { client, projects, invoices, deliverables, documents } = summary;
  const { showToast } = useToast();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // New Project Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState(15000);
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() =>
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [tagsStr, setTagsStr] = useState('Design, Development');

  // Milestone Form modal
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState(() =>
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    await ProjectService.createProject({
      clientId: client.id,
      clientName: client.company,
      title,
      description,
      status: 'in_progress',
      priority,
      budget: Number(budget),
      startDate,
      dueDate,
      tags,
    });
    showToast('Project Created', `Project "${title}" added to ${client.company} workspace.`, 'success');
    setIsCreateModalOpen(false);
    resetForm();
    onRefresh();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setBudget(15000);
    setPriority('medium');
  };

  const handleToggleMilestone = async (projectId: string, milestoneId: string) => {
    await ProjectService.toggleMilestone(projectId, milestoneId);
    showToast('Milestone Updated', 'Project progress updated dynamically.', 'info');
    onRefresh();
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !milestoneTitle) return;
    await ProjectService.addMilestone(selectedProject.id, milestoneTitle, milestoneDate);
    showToast('Milestone Added', `Milestone added to "${selectedProject.title}".`, 'success');
    setIsMilestoneModalOpen(false);
    setMilestoneTitle('');
    onRefresh();
  };

  const handleMarkComplete = async (project: Project) => {
    await ProjectService.markProjectComplete(project.id);
    showToast('Project Completed', `"${project.title}" marked as complete.`, 'success');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-white" />
            Client Projects Workspace
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Track project deliverables, milestones, budgets, and linked billing for {client.company}.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Project
        </Button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card variant="crystal" className="p-12 text-center space-y-4">
          <FolderKanban className="w-12 h-12 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Projects Active</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Create a project to structure milestones, track deliverable approvals, and generate client invoices.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setIsCreateModalOpen(true)}>
            Create First Project
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map((proj) => {
            const linkedDelivs = deliverables.filter(
              (d) => d.projectId === proj.id || d.linkedProjectId === proj.id
            );
            const linkedDocs = documents.filter((doc) => doc.clientId === client.id);
            const linkedInvoices = invoices.filter((inv) => inv.clientId === client.id);

            return (
              <Card
                key={proj.id}
                variant="crystal"
                className="p-6 space-y-5 border-white/10 hover:border-white/20 transition-all duration-300"
              >
                {/* Project Title Bar */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white tracking-tight">{proj.title}</h3>
                      <StatusPill status={proj.status} />
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-2">{proj.description}</p>
                  </div>
                  {proj.priority && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase shrink-0 ${
                        proj.priority === 'high'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : proj.priority === 'medium'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-zinc-800 text-zinc-400 border-white/10'
                      }`}
                    >
                      <Flag className="w-2.5 h-2.5 inline mr-1" />
                      {proj.priority} priority
                    </span>
                  )}
                </div>

                {/* Progress Meter */}
                <div className="space-y-2 p-3.5 rounded-xl bg-zinc-900/60 border border-white/10">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-400">Project Completion</span>
                    <span className="text-white font-bold">{proj.completionPercentage}%</span>
                  </div>
                  <Progress value={proj.completionPercentage} size="sm" />
                </div>

                {/* Milestones List */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase text-zinc-400 font-semibold">
                      Milestones ({proj.milestones?.filter((m) => m.completed).length || 0}/
                      {proj.milestones?.length || 0})
                    </span>
                    <button
                      onClick={() => {
                        setSelectedProject(proj);
                        setIsMilestoneModalOpen(true);
                      }}
                      className="text-[11px] font-mono text-zinc-400 hover:text-white transition-colors"
                    >
                      + Add Milestone
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {proj.milestones && proj.milestones.length > 0 ? (
                      proj.milestones.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => handleToggleMilestone(proj.id, m.id)}
                          className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/15 cursor-pointer transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2">
                            {m.completed ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-500 shrink-0" />
                            )}
                            <span
                              className={`${
                                m.completed ? 'line-through text-zinc-500' : 'text-zinc-200 font-medium'
                              }`}
                            >
                              {m.title}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-500">{m.dueDate}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-zinc-500 italic">No milestones set for this project.</p>
                    )}
                  </div>
                </div>

                {/* Linked Assets Pill Bar */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-400 pt-2 border-t border-white/10">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-zinc-500" />
                    Budget: <strong className="text-white">${proj.budget.toLocaleString()}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    Due: <strong className="text-white">{proj.dueDate}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-zinc-500" />
                    Deliverables: <strong className="text-white">{linkedDelivs.length}</strong>
                  </span>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex flex-wrap gap-1">
                    {proj.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-white/5 px-2 py-0.5 rounded"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  {proj.status !== 'completed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkComplete(proj)}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    >
                      Complete
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Project Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Client Project">
        <form onSubmit={handleCreateProject} className="space-y-4">
          <Input
            label="Project Title"
            placeholder="e.g. Brand Identity & Web System Overhaul"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">Description & Scope</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of deliverables and goals..."
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Budget ($ USD)"
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-300">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="Target Deadline"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          <Input
            label="Tags (comma separated)"
            placeholder="Branding, Web design, Framer"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Milestone Modal */}
      <Modal
        isOpen={isMilestoneModalOpen}
        onClose={() => setIsMilestoneModalOpen(false)}
        title={`Add Milestone to ${selectedProject?.title || 'Project'}`}
      >
        <form onSubmit={handleAddMilestone} className="space-y-4">
          <Input
            label="Milestone Title"
            placeholder="e.g. Design Tokens Handover & Review"
            value={milestoneTitle}
            onChange={(e) => setMilestoneTitle(e.target.value)}
            required
          />
          <Input
            label="Target Completion Date"
            type="date"
            value={milestoneDate}
            onChange={(e) => setMilestoneDate(e.target.value)}
            required
          />
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setIsMilestoneModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Add Milestone
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
