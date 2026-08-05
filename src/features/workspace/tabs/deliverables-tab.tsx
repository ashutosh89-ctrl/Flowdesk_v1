import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import { Modal } from '../../../components/ui/modal';
import { Input } from '../../../components/ui/input';
import { DeliverableService } from '../../../services';
import { WorkspaceSummary, Deliverable, DeliverableVersion } from '../../../types';
import {
  CheckCircle2,
  AlertCircle,
  Plus,
  History,
  MessageSquare,
  Download,
  Eye,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useToast } from '../../../components/ui/toast';

export interface DeliverablesTabProps {
  summary: WorkspaceSummary;
  onRefresh: () => void;
}

export const DeliverablesTab: React.FC<DeliverablesTabProps> = ({ summary, onRefresh }) => {
  const { deliverables, projects, client } = summary;
  const { showToast } = useToast();

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [newVersionDeliv, setNewVersionDeliv] = useState<Deliverable | null>(null);
  const [expandedDelivId, setExpandedDelivId] = useState<string | null>(null);
  const [revisionDeliv, setRevisionDeliv] = useState<Deliverable | null>(null);
  const [revisionNote, setRevisionNote] = useState('');

  // Submit Deliverable state
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [version, setVersion] = useState('v1.0.0');
  const [dueDate, setDueDate] = useState('2026-08-30');
  const [description, setDescription] = useState('');
  const [fileSize, setFileSize] = useState('4.5 MB');

  // New Version state
  const [newVerTag, setNewVerTag] = useState('v1.1.0');
  const [newVerNote, setNewVerNote] = useState('');

  const handleSubmitDeliverable = (e: React.FormEvent) => {
    e.preventDefault();
    DeliverableService.addDeliverable({
      clientId: client.id,
      projectId: projectId || (projects[0]?.id ?? 'proj-1'),
      title,
      description,
      status: 'in_review',
      dueDate,
      version,
      fileSize,
      fileUrl: `https://flowdesk.app/assets/${title.toLowerCase().replace(/\s+/g, '-')}`,
    }).then(() => {
      showToast('Deliverable Submitted', `Submitted "${title}" (${version}) for review.`, 'success');
      setIsSubmitModalOpen(false);
      resetForm();
      onRefresh();
    });
  };

  const handleUploadNewVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionDeliv) return;
    DeliverableService.uploadNewVersion(newVersionDeliv.id, {
      version: newVerTag,
      note: newVerNote || 'Updated version uploaded',
      fileUrl: `#`,
      fileName: `${newVersionDeliv.title.toLowerCase().replace(/\s+/g, '-')}-${newVerTag}.pdf`,
      fileSize: '3.1 MB',
      uploadedBy: 'Alex Rivera',
    }).then(() => {
      showToast('New Version Uploaded', `Uploaded ${newVerTag} for "${newVersionDeliv.title}".`, 'success');
      setNewVersionDeliv(null);
      setNewVerNote('');
      onRefresh();
    });
  };

  const handleUpdateStatus = (id: string, newStatus: Deliverable['status'], note?: string) => {
    if (newStatus === 'approved') {
      DeliverableService.approveDeliverable(id, note).then(() => {
        showToast('Work Approved', `Deliverable approved and signed off!`, 'success');
        onRefresh();
      });
    } else if (newStatus === 'changes_requested') {
      DeliverableService.requestDeliverableRevision(id, note || '').then(() => {
        showToast('Revision Requested', `Revisions logged for deliverable.`, 'info');
        setRevisionDeliv(null);
        setRevisionNote('');
        onRefresh();
      });
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setVersion('v1.0.0');
  };

  return (
    <div className="space-y-6">
      <Card variant="crystal">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{client.company} Deliverables & Sign-Off Cards</CardTitle>
              <CardDescription>Formal submission, version tracking & client approval</CardDescription>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsSubmitModalOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Submit Deliverable
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {deliverables.length === 0 ? (
              <p className="text-xs text-zinc-400 italic col-span-2">No deliverables submitted yet.</p>
            ) : (
              deliverables.map((del) => {
                const isExpanded = expandedDelivId === del.id;
                return (
                  <div
                    key={del.id}
                    className="p-5 rounded-2xl bg-zinc-900/60 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                          {del.version}
                        </span>
                        <StatusPill status={del.status} />
                      </div>
                      <h4 className="text-base font-bold text-white">{del.title}</h4>
                      <p className="text-xs text-zinc-400 mt-1">{del.description}</p>

                      {del.revisionNote && (
                        <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                          <strong className="block font-mono text-[10px] uppercase">Client Revision Feedback:</strong>
                          {del.revisionNote}
                        </div>
                      )}

                      <div className="mt-3 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                        <span>Due: {del.dueDate}</span>
                        <span>Size: {del.fileSize || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Version History Toggle */}
                    {del.versionHistory && del.versionHistory.length > 0 && (
                      <div className="pt-2 border-t border-white/5">
                        <button
                          onClick={() => setExpandedDelivId(isExpanded ? null : del.id)}
                          className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-white py-1 transition-colors font-mono"
                        >
                          <span className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-zinc-400" /> Version History ({del.versionHistory.length})
                          </span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2 pl-2 border-l border-white/10">
                            {del.versionHistory.map((v) => (
                              <div key={v.id} className="text-xs p-2 rounded-lg bg-black/30 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-white font-bold">{v.version}</span>
                                  <span className="text-[10px] text-zinc-500 font-mono">{v.date}</span>
                                </div>
                                <p className="text-[11px] text-zinc-400">{v.note}</p>
                                <span className="text-[10px] text-zinc-500 font-mono block">By {v.uploadedBy}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setNewVersionDeliv(del)}
                        leftIcon={<History className="w-3.5 h-3.5" />}
                      >
                        New Version
                      </Button>

                    <div className="flex items-center gap-2 ml-auto">
                      {del.status !== 'approved' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setRevisionDeliv(del)}
                            leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                          >
                            Request Changes
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleUpdateStatus(del.id, 'approved')}
                            leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                          >
                            Approve Work
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Deliverable Modal */}
      <Modal isOpen={isSubmitModalOpen} onClose={() => setIsSubmitModalOpen(false)} title="Submit Deliverable for Client Review">
        <form onSubmit={handleSubmitDeliverable} className="space-y-4">
          <Input
            label="Deliverable Title"
            placeholder="e.g. Core UI Kit & Token Spec"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-300">Target Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-white/30"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Version Tag"
              placeholder="e.g. v1.0.0 or v2.1-rc"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              required
            />
          </div>

          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">Submission Description & Notes</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key updates, specs, or handover instructions..."
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setIsSubmitModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Submit Deliverable
            </Button>
          </div>
        </form>
      </Modal>

      {/* Upload New Version Modal */}
      <Modal isOpen={!!newVersionDeliv} onClose={() => setNewVersionDeliv(null)} title={`Upload New Version: ${newVersionDeliv?.title}`}>
        <form onSubmit={handleUploadNewVersion} className="space-y-4">
          <Input
            label="New Version Tag"
            placeholder="e.g. v1.1.0"
            value={newVerTag}
            onChange={(e) => setNewVerTag(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">Release Notes / Version Diff</label>
            <textarea
              rows={3}
              value={newVerNote}
              onChange={(e) => setNewVerNote(e.target.value)}
              placeholder="Describe what changed in this revision..."
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setNewVersionDeliv(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Publish New Version
            </Button>
          </div>
        </form>
      </Modal>

      {/* Request Changes Modal */}
      <Modal isOpen={!!revisionDeliv} onClose={() => setRevisionDeliv(null)} title="Request Revisions on Deliverable">
        <div className="space-y-4">
          <p className="text-xs text-zinc-300">
            Specify revision details for <strong className="text-white">{revisionDeliv?.title}</strong> ({revisionDeliv?.version}):
          </p>

          <textarea
            rows={4}
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
            placeholder="e.g. Please increase border radius on buttons to 12px and update primary accent contrast..."
            className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" onClick={() => setRevisionDeliv(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => revisionDeliv && handleUpdateStatus(revisionDeliv.id, 'changes_requested', revisionNote)}
            >
              Submit Revision Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
