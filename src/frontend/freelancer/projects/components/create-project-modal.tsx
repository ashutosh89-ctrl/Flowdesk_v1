import React, { useState, useEffect } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { Input } from '@/frontend/shared/ui/input';
import { Button } from '@/frontend/shared/ui/button';
import { FreelancerProjectService as ProjectService, FreelancerClientService as ClientService } from '@/backend/freelancer';
import { Client, Project, ProjectMilestone } from '@/shared/types';
import { useToast } from '@/frontend/shared/ui/toast';
import { useAuth } from '@/frontend/auth/auth-context';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultClientId?: string;
  clients?: Client[];
  onSuccess?: (newProject: Project) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  defaultClientId,
  clients: propClients,
  onSuccess,
}) => {
  const { profile, userSettings } = useAuth();
  const currencySymbol = getCurrencySymbol(userSettings?.currency || profile?.currency || 'USD');
  const { showToast } = useToast();

  const [fetchedClients, setFetchedClients] = useState<Client[]>([]);
  const clients = propClients && propClients.length > 0 ? propClients : fetchedClients;
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState(defaultClientId || '');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('15000');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [tagsStr, setTagsStr] = useState('Design, Development');

  // Initial milestones list (lazy initializer for purity)
  const [milestones, setMilestones] = useState<{ title: string; dueDate: string }[]>(() => {
    const d1 = new Date();
    d1.setDate(d1.getDate() + 7);
    const d2 = new Date();
    d2.setDate(d2.getDate() + 18);
    return [
      { title: 'Project Kickoff & Strategy', dueDate: d1.toISOString().split('T')[0] },
      { title: 'First Deliverable Review', dueDate: d2.toISOString().split('T')[0] },
    ];
  });
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDue, setNewMilestoneDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && (!propClients || propClients.length === 0)) {
      ClientService.getClients().then((cls) => {
        setFetchedClients(cls);
      });
    }
  }, [isOpen, propClients]);

  const addMilestone = () => {
    if (!newMilestoneTitle.trim()) return;
    setMilestones((prev) => [
      ...prev,
      { title: newMilestoneTitle.trim(), dueDate: newMilestoneDue || dueDate },
    ]);
    setNewMilestoneTitle('');
  };

  const removeMilestone = (index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setBudget('15000');
    setPriority('medium');
    setStartDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().split('T')[0]);
    setTagsStr('Design, Development');
    setMilestones([
      { title: 'Project Kickoff & Strategy', dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] },
      { title: 'First Deliverable Review', dueDate: new Date(Date.now() + 18 * 86400000).toISOString().split('T')[0] },
    ]);
    setNewMilestoneTitle('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Project title is required.');
      return;
    }

    const effectiveClientId = clientId || clients[0]?.id;
    if (!effectiveClientId) {
      setError('Please select or create a client workspace first.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const targetClient = clients.find((c) => c.id === effectiveClientId);
      const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);

      const createdMilestones: ProjectMilestone[] = milestones.map((m, idx) => ({
        id: `ms-${Date.now()}-${idx}`,
        projectId: '',
        title: m.title,
        dueDate: m.dueDate,
        completed: false,
      }));

      const newProject = await ProjectService.createProject({
        clientId: effectiveClientId,
        clientName: targetClient ? targetClient.company : 'Client',
        title: title.trim(),
        description: description.trim(),
        status: 'in_progress',
        budget: parseFloat(budget) || 10000,
        startDate,
        dueDate,
        tags: tags.length > 0 ? tags : ['Design', 'Engineering'],
        milestones: createdMilestones,
      });

      showToast('Project Created', `Project "${title.trim()}" initialized.`, 'success');
      resetForm();
      onClose();
      if (onSuccess) {
        onSuccess(newProject);
      }
    } catch (err: any) {
      console.error('Create project error:', err);
      setError(err?.message || 'Failed to create project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Project">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            {error}
          </div>
        )}

        <Input
          label="Project Title"
          placeholder="e.g. Design Systems & Mobile App Refresh"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-300">Target Client Workspace</label>
          <select
            value={clientId || defaultClientId || clients[0]?.id || ''}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-white/30"
            required
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id} className="bg-zinc-900">
                {c.company} ({c.name})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={`Budget (${currencySymbol})`}
            type="number"
            min="0"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">Priority Level</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-white/30"
            >
              <option value="high" className="bg-zinc-900">High Priority</option>
              <option value="medium" className="bg-zinc-900">Medium Priority</option>
              <option value="low" className="bg-zinc-900">Low Priority</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
          <Input
            label="Target Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-300">Project Description & Scope</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Outline goals, deliverables, and expectations for the client..."
            className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
          />
        </div>

        <Input
          label="Tags (comma separated)"
          placeholder="Branding, UI/UX, Architecture, Mobile"
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
        />

        {/* Milestones Setup */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <label className="text-xs font-semibold text-zinc-200">Project Milestones</label>
          <div className="space-y-1.5">
            {milestones.map((ms, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-white font-medium">{ms.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400 font-mono">Due {ms.dueDate}</span>
                  <button
                    type="button"
                    onClick={() => removeMilestone(idx)}
                    className="text-zinc-500 hover:text-rose-400 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <input
              type="text"
              placeholder="New milestone name..."
              value={newMilestoneTitle}
              onChange={(e) => setNewMilestoneTitle(e.target.value)}
              className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
            />
            <input
              type="date"
              value={newMilestoneDue}
              onChange={(e) => setNewMilestoneDue(e.target.value)}
              className="bg-zinc-900 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-white/30"
            />
            <Button type="button" variant="secondary" size="sm" onClick={addMilestone} leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating Project...' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
