import React, { useState } from 'react';
import { Modal } from '../../../components/ui/modal';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Client, Project, DeliverablePriority } from '../../../types';
import { Layers, Calendar, FileText, Lock, MessageSquare, AlertCircle } from 'lucide-react';

interface CreateDeliverableModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  projects: Project[];
  defaultClientId?: string;
  defaultProjectId?: string;
  onCreate: (delData: any) => Promise<void>;
}

export const CreateDeliverableModal: React.FC<CreateDeliverableModalProps> = ({
  isOpen,
  onClose,
  clients,
  projects,
  defaultClientId,
  defaultProjectId,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState(defaultClientId || clients[0]?.id || '');
  const [projectId, setProjectId] = useState(defaultProjectId || projects[0]?.id || '');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [reviewDeadline, setReviewDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().split('T')[0];
  });
  const [version, setVersion] = useState('v1.0.0');
  const [priority, setPriority] = useState<DeliverablePriority>('medium');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('3.5 MB');
  const [fileUrl, setFileUrl] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter projects by selected client if needed
  const availableProjects = projects.filter((p) => p.clientId === clientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreate({
        clientId: clientId || clients[0]?.id || 'cli-1',
        projectId: projectId || availableProjects[0]?.id || projects[0]?.id || 'proj-1',
        title: title.trim(),
        description: description.trim(),
        dueDate,
        reviewDeadline,
        version: version || 'v1.0.0',
        priority,
        fileName: fileName || `${title.toLowerCase().replace(/\s+/g, '-')}-v1.pdf`,
        fileSize: fileSize || '3.5 MB',
        fileUrl: fileUrl || `https://flowdesk.app/deliverables/${title.toLowerCase().replace(/\s+/g, '-')}`,
        internalNotes: internalNotes.trim(),
        submissionMessage: submissionMessage.trim(),
        status: 'draft',
        approvalStatus: 'pending',
      });
      onClose();
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setVersion('v1.0.0');
    setPriority('medium');
    setFileName('');
    setFileUrl('');
    setInternalNotes('');
    setSubmissionMessage('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Deliverable Package" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5 select-none">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Deliverable Title *"
            placeholder="e.g., Core UI Kit & Token Specification"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Client Account *
            </label>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                const firstProj = projects.find((p) => p.clientId === e.target.value);
                if (firstProj) setProjectId(firstProj.id);
              }}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Project Link
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30"
            >
              {availableProjects.length > 0
                ? availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))
                : projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
            </select>
          </div>

          <Input
            label="Version Tag"
            placeholder="e.g. v1.0.0"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as DeliverablePriority)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
            Deliverable Scope & Summary
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief overview of what this deliverable package contains..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Delivery Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <Input
            label="Client Review Deadline"
            type="date"
            value={reviewDeadline}
            onChange={(e) => setReviewDeadline(e.target.value)}
          />
        </div>

        {/* Initial File Upload Mock section */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Primary Asset File Attachment</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label="File Name"
              placeholder="e.g., design-spec-v1.pdf"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
            <Input
              label="File Size"
              placeholder="e.g., 4.5 MB"
              value={fileSize}
              onChange={(e) => setFileSize(e.target.value)}
            />
            <Input
              label="Asset Download URL"
              placeholder="https://..."
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
            />
          </div>
        </div>

        {/* Internal Notes & Submission Message */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Internal Freelancer Notes</span>
            </label>
            <textarea
              rows={2}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Notes hidden from client (e.g. key Figma node IDs)..."
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-purple-400" />
              <span>Client Submission Message</span>
            </label>
            <textarea
              rows={2}
              value={submissionMessage}
              onChange={(e) => setSubmissionMessage(e.target.value)}
              placeholder="Message attached when submitting to client..."
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Create Deliverable
          </Button>
        </div>
      </form>
    </Modal>
  );
};
