import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { StatusBadge } from './status-badge';
import { ApprovalBadge } from './approval-badge';
import { DeliverableService } from '../../../services';
import { FlowDeskStore } from '../../../services/storage-store';
import {
  Deliverable,
  Client,
  Project,
  DeliverableVersion,
  DeliverableFile,
  DeliverableComment,
  DeliverableRevision,
  DeliverableTimelineItem,
  DeliverableActivity,
} from '../../../types';
import {
  Layers,
  Calendar,
  Clock,
  FileText,
  MessageSquare,
  History,
  CheckCircle2,
  AlertTriangle,
  Send,
  Lock,
  Plus,
  Copy,
  Archive,
  Trash2,
  Download,
  Eye,
  Edit2,
  Pin,
  Check,
  X,
  FileCheck,
  GitCommit,
  ArrowRight,
  User,
  ExternalLink,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Folder,
} from 'lucide-react';
import { useToast } from '../../../components/ui/toast';

interface DeliverableWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliverableId: string | null;
  clients: Client[];
  projects: Project[];
  onRefresh: () => void;
}

export const DeliverableWorkspaceModal: React.FC<DeliverableWorkspaceModalProps> = ({
  isOpen,
  onClose,
  deliverableId,
  clients,
  projects,
  onRefresh,
}) => {
  const { showToast } = useToast();
  const [deliverable, setDeliverable] = useState<Deliverable | null>(() =>
    deliverableId ? FlowDeskStore.getDeliverableById(deliverableId) || null : null
  );
  const [activeTab, setActiveTab] = useState<
    'overview' | 'files' | 'versions' | 'approval' | 'comments' | 'revisions' | 'timeline' | 'activity' | 'notes'
  >('overview');

  // Sub-modal states
  const [isAddVersionOpen, setIsAddVersionOpen] = useState(false);
  const [newVersionTag, setNewVersionTag] = useState('');
  const [newVersionNote, setNewVersionNote] = useState('');
  const [newVersionFileName, setNewVersionFileName] = useState('');

  const [isAddFileOpen, setIsAddFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileSize, setNewFileSize] = useState('2.4 MB');
  const [newFileType, setNewFileType] = useState('pdf');
  const [newFileFolder, setNewFileFolder] = useState('Root');

  // Compare Versions modal
  const [compareVersions, setCompareVersions] = useState<{
    v1: DeliverableVersion;
    v2: DeliverableVersion;
  } | null>(null);

  // File rename state
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState('');

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);

  // Client Review action notes modal
  const [reviewAction, setReviewAction] = useState<'approve' | 'revision' | 'reject' | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  // Internal Notes auto-save state
  const [internalNotesText, setInternalNotesText] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Preview file modal
  const [previewFile, setPreviewFile] = useState<DeliverableFile | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (deliverableId) {
      DeliverableService.getDeliverableById(deliverableId).then((del) => {
        if (isMounted && del) {
          setDeliverable(del);
          setInternalNotesText(del.internalNotes || '');
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [deliverableId]);

  const loadDeliverable = async (id: string) => {
    const del = await DeliverableService.getDeliverableById(id);
    if (del) {
      setDeliverable(del);
      setInternalNotesText(del.internalNotes || '');
    }
  };

  if (!deliverable) return null;

  const client = clients.find((c) => c.id === deliverable.clientId);
  const project = projects.find((p) => p.id === deliverable.projectId);
  const clientName = client?.company || client?.name || 'Unassigned Client';
  const projectName = project?.title || 'General Project';

  const filesList = deliverable.files || [];
  const versionsList = deliverable.versionHistory || [];
  const commentsList = deliverable.comments || [];
  const revisionsList = deliverable.revisions || [];
  const approvalsList = deliverable.approvals || [];
  const timelineList = deliverable.timeline || [];
  const activityList = deliverable.activityLog || [];

  // Version Upload Handler
  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionTag.trim()) return;

    await DeliverableService.uploadNewVersion(deliverable.id, {
      version: newVersionTag.trim(),
      note: newVersionNote.trim() || 'New deliverable iteration',
      fileName: newVersionFileName.trim() || `${deliverable.title.toLowerCase().replace(/\s+/g, '-')}-${newVersionTag}.zip`,
      fileSize: '4.2 MB',
      uploadedBy: 'Alex Rivera',
    });

    showToast('Version Uploaded', `Created new version ${newVersionTag.trim()}`, 'success');
    setIsAddVersionOpen(false);
    setNewVersionTag('');
    setNewVersionNote('');
    setNewVersionFileName('');
    loadDeliverable(deliverable.id);
    onRefresh();
  };

  // Restore Version Handler
  const handleRestoreVersion = async (versionId: string, versionNumber: string) => {
    await DeliverableService.restoreDeliverableVersion(deliverable.id, versionId);
    showToast('Version Restored', `Restored deliverable to ${versionNumber}`, 'success');
    loadDeliverable(deliverable.id);
    onRefresh();
  };

  // Add File Handler
  const handleAddFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    await DeliverableService.addDeliverableFile(deliverable.id, {
      fileName: newFileName.trim(),
      fileSize: newFileSize || '2.4 MB',
      fileType: newFileType || 'pdf',
      folder: newFileFolder || 'Root',
    });

    showToast('File Attached', `Added "${newFileName.trim()}" to deliverable package.`, 'success');
    setIsAddFileOpen(false);
    setNewFileName('');
    loadDeliverable(deliverable.id);
    onRefresh();
  };

  // Rename File
  const handleSaveRenameFile = async (fileId: string) => {
    if (!editingFileName.trim()) return;
    await DeliverableService.renameDeliverableFile(deliverable.id, fileId, editingFileName.trim());
    setEditingFileId(null);
    showToast('File Renamed', 'Updated asset filename', 'success');
    loadDeliverable(deliverable.id);
  };

  // Delete File
  const handleDeleteFile = async (fileId: string) => {
    await DeliverableService.deleteDeliverableFile(deliverable.id, fileId);
    showToast('File Removed', 'File deleted from package', 'info');
    loadDeliverable(deliverable.id);
    onRefresh();
  };

  // Pin File
  const handleTogglePinFile = async (fileId: string) => {
    await DeliverableService.togglePinDeliverableFile(deliverable.id, fileId);
    loadDeliverable(deliverable.id);
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    await DeliverableService.addDeliverableComment(deliverable.id, {
      author: 'Alex Rivera',
      authorRole: isInternalComment ? 'freelancer' : 'freelancer',
      isInternal: isInternalComment,
      content: commentText.trim(),
      replyToId: replyToId || undefined,
    });

    setCommentText('');
    setReplyToId(null);
    showToast('Comment Added', isInternalComment ? 'Added internal note' : 'Posted comment for client', 'success');
    loadDeliverable(deliverable.id);
  };

  // Resolve Comment
  const handleToggleResolveComment = async (commentId: string) => {
    await DeliverableService.toggleResolveDeliverableComment(deliverable.id, commentId);
    loadDeliverable(deliverable.id);
  };

  // Client Sign-off Review submission
  const handleSubmitReview = async () => {
    if (!reviewAction) return;
    await DeliverableService.submitDeliverableClientReview(deliverable.id, {
      action: reviewAction,
      notes: reviewNote,
      reviewerName: clientName,
    });

    showToast(
      reviewAction === 'approve' ? 'Deliverable Approved' : 'Review Updated',
      `Client review recorded as ${reviewAction.toUpperCase()}`,
      reviewAction === 'approve' ? 'success' : 'info'
    );
    setReviewAction(null);
    setReviewNote('');
    loadDeliverable(deliverable.id);
    onRefresh();
  };

  // Internal Notes Save
  const handleSaveInternalNotes = async () => {
    setIsSavingNotes(true);
    await DeliverableService.updateDeliverableInternalNotes(deliverable.id, internalNotesText);
    setIsSavingNotes(false);
    showToast('Notes Saved', 'Internal deliverable notes updated.', 'success');
    loadDeliverable(deliverable.id);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="space-y-6 select-none -m-1">
        {/* Workspace Top Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-white/10 border border-white/15 text-xs font-mono font-bold text-white">
                {deliverable.version}
              </span>
              <StatusBadge status={deliverable.status} size="sm" />
              <ApprovalBadge status={deliverable.approvalStatus} size="sm" />
              {deliverable.priority && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${
                    deliverable.priority === 'high'
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                      : deliverable.priority === 'medium'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {deliverable.priority} priority
                </span>
              )}
            </div>

            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <Layers className="w-6 h-6 text-emerald-400" />
              <span>{deliverable.title}</span>
            </h1>

            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1 font-medium text-zinc-300">
                <User className="w-3.5 h-3.5 text-zinc-500" />
                {clientName}
              </span>
              <span>•</span>
              <span className="text-zinc-400">{projectName}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                Due: {deliverable.dueDate}
              </span>
            </div>
          </div>

          {/* Header Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewVersionTag(`v${(parseFloat(deliverable.version.replace('v', '')) + 0.1).toFixed(1)}.0`);
                setIsAddVersionOpen(true);
              }}
              leftIcon={<GitCommit className="w-3.5 h-3.5 text-blue-400" />}
            >
              New Version
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddFileOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5 text-emerald-400" />}
            >
              Add File
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                DeliverableService.updateDeliverable(deliverable.id, {
                  status: 'submitted',
                  approvalStatus: 'pending',
                }).then(() => {
                  showToast('Submitted for Review', `Deliverable package sent to ${clientName}`, 'success');
                  loadDeliverable(deliverable.id);
                  onRefresh();
                });
              }}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Submit Package
            </Button>
          </div>
        </div>

        {/* Workspace Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-white/10 overflow-x-auto pb-1 scrollbar-none">
          {[
            { key: 'overview', label: 'Overview', icon: <Layers className="w-4 h-4" /> },
            {
              key: 'files',
              label: `Files (${filesList.length})`,
              icon: <FileText className="w-4 h-4" />,
            },
            {
              key: 'versions',
              label: `Versions (${versionsList.length})`,
              icon: <GitCommit className="w-4 h-4" />,
            },
            { key: 'approval', label: 'Client Sign-Off', icon: <FileCheck className="w-4 h-4" /> },
            {
              key: 'comments',
              label: `Comments (${commentsList.length})`,
              icon: <MessageSquare className="w-4 h-4" />,
            },
            {
              key: 'revisions',
              label: `Revisions (${revisionsList.length})`,
              icon: <AlertTriangle className="w-4 h-4" />,
            },
            { key: 'timeline', label: 'Timeline', icon: <Clock className="w-4 h-4" /> },
            { key: 'activity', label: 'Activity Log', icon: <History className="w-4 h-4" /> },
            { key: 'notes', label: 'Internal Notes', icon: <Lock className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTab === tab.key
                  ? 'bg-white/10 text-white shadow-inner border border-white/15'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB CONTENTS */}

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Description, Submission Message, Quick Summary */}
              <div className="lg:col-span-2 space-y-6">
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Package Description & Scope
                  </h3>
                  <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {deliverable.description || 'No description provided.'}
                  </p>
                </div>

                {deliverable.submissionMessage && (
                  <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-wider">
                      <Send className="w-4 h-4 text-purple-400" />
                      <span>Submission Message to Client</span>
                    </div>
                    <p className="text-sm text-purple-100 italic">
                      &quot;{deliverable.submissionMessage}&quot;
                    </p>
                  </div>
                )}

                {deliverable.revisionNote && (
                  <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Latest Revision Note</span>
                    </div>
                    <p className="text-sm text-amber-100">{deliverable.revisionNote}</p>
                  </div>
                )}

                {/* Primary Assets Preview */}
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <span>Attached Deliverable Files ({filesList.length})</span>
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('files')}
                      className="text-xs"
                    >
                      Manage All Files
                    </Button>
                  </div>

                  {filesList.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">No files attached to this deliverable.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filesList.slice(0, 4).map((f) => (
                        <div
                          key={f.id}
                          className="p-3 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-between hover:border-white/20 transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{f.fileName}</p>
                              <p className="text-[10px] text-zinc-500">{f.fileSize}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setPreviewFile(f)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                            title="Preview File"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Col: Metadata Sidebar */}
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Deliverable Details
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-zinc-500">Current Version</span>
                      <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-white/10 border border-white/15">
                        {deliverable.version}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-zinc-500">Delivery Status</span>
                      <StatusBadge status={deliverable.status} size="sm" />
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-zinc-500">Approval Status</span>
                      <ApprovalBadge status={deliverable.approvalStatus} size="sm" />
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-zinc-500">Delivery Due Date</span>
                      <span className="font-semibold text-white">{deliverable.dueDate}</span>
                    </div>

                    {deliverable.reviewDeadline && (
                      <div className="flex justify-between items-center py-1 border-b border-white/5">
                        <span className="text-zinc-500">Client Review Deadline</span>
                        <span className="font-semibold text-amber-300">{deliverable.reviewDeadline}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-zinc-500">Created Date</span>
                      <span className="text-zinc-400">{deliverable.createdAt || 'Recent'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-zinc-500">Last Updated</span>
                      <span className="text-zinc-400">{deliverable.updatedAt || 'Today'}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Client Sign-off Trigger */}
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                      Client Sign-Off Quick Actions
                    </h4>
                  </div>
                  <p className="text-xs text-emerald-200/80">
                    Simulate client review & formal sign-off decisions directly.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setReviewAction('approve')}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500"
                    >
                      Approve Work
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReviewAction('revision')}
                      className="text-xs text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                    >
                      Request Revision
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. FILES TAB */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Deliverable Asset Files ({filesList.length})</span>
              </h3>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddFileOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Attach New File
              </Button>
            </div>

            {filesList.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-white/10 bg-white/[0.02]">
                <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-300">No files attached yet</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Attach GLTF 3D models, PDF specs, ZIP archives, or Figma tokens.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filesList.map((file) => (
                  <div
                    key={file.id}
                    className={`p-4 rounded-2xl border bg-zinc-950/80 backdrop-blur-xl flex flex-col justify-between space-y-3 transition-all ${
                      file.isPinned ? 'border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          {editingFileId === file.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingFileName}
                                onChange={(e) => setEditingFileName(e.target.value)}
                                className="px-2 py-1 rounded bg-zinc-900 border border-white/20 text-xs text-white"
                              />
                              <button
                                onClick={() => handleSaveRenameFile(file.id)}
                                className="p-1 text-emerald-400 hover:text-emerald-300"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <h4 className="text-sm font-bold text-white truncate flex items-center gap-2">
                              <span>{file.fileName}</span>
                              {file.isPinned && <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                            </h4>
                          )}
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {file.fileSize} • Uploaded {file.uploadedAt} by {file.uploadedBy}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTogglePinFile(file.id)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            file.isPinned ? 'text-amber-400 bg-amber-500/10' : 'text-zinc-400 hover:text-white hover:bg-white/10'
                          }`}
                          title="Pin file"
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                          title="Preview"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingFileId(file.id);
                            setEditingFileName(file.fileName);
                          }}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                          title="Rename"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFile(file.id)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5 text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Folder className="w-3 h-3 text-zinc-500" />
                        {file.folder || 'Root'}
                      </span>
                      <a
                        href={file.fileUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-emerald-400 hover:underline font-medium"
                      >
                        <Download className="w-3 h-3" /> Download Asset
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. VERSIONS TAB */}
        {activeTab === 'versions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  <GitCommit className="w-4 h-4 text-blue-400" />
                  <span>Version History & Diff Engine</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Every version iteration is preserved with metadata, notes, and file packages.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setNewVersionTag(`v${(parseFloat(deliverable.version.replace('v', '')) + 0.1).toFixed(1)}.0`);
                  setIsAddVersionOpen(true);
                }}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Publish New Version
              </Button>
            </div>

            <div className="space-y-4">
              {versionsList.map((ver, idx) => {
                const isCurrent = ver.version === deliverable.version || ver.isCurrentVersion;
                const prevVer = versionsList[idx + 1];

                return (
                  <div
                    key={ver.id || idx}
                    className={`p-5 rounded-2xl border bg-zinc-950/80 backdrop-blur-xl transition-all ${
                      isCurrent
                        ? 'border-emerald-500/40 bg-emerald-500/[0.03] shadow-[0_0_20px_rgba(16,185,129,0.08)]'
                        : 'border-white/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/15 text-sm font-mono font-bold text-white">
                          {ver.version}
                        </span>

                        {isCurrent ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Current Live Release
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-500 font-medium">Historical Version</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {prevVer && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCompareVersions({ v1: prevVer, v2: ver })}
                            className="text-xs text-blue-300 border-blue-500/30 hover:bg-blue-500/10"
                            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                          >
                            Compare with {prevVer.version}
                          </Button>
                        )}

                        {!isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestoreVersion(ver.id, ver.version)}
                            className="text-xs"
                          >
                            Restore Version
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-zinc-200 mb-3">{ver.note || 'No revision notes recorded.'}</p>

                    <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-2">
                      <div className="flex items-center gap-4">
                        <span>
                          File: <span className="text-zinc-200 font-mono">{ver.fileName || 'asset-package.zip'}</span>
                        </span>
                        <span>Size: {ver.fileSize || 'N/A'}</span>
                        <span>By: {ver.uploadedBy || 'Alex Rivera'}</span>
                      </div>
                      <span className="text-zinc-500">Released on {ver.date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. CLIENT SIGN-OFF / APPROVAL TAB */}
        {activeTab === 'approval' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-400" />
                    <span>Client Review & Formal Sign-Off Engine</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Record client approval status, sign-off notes, or formal change requests.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <ApprovalBadge status={deliverable.approvalStatus} size="lg" />
                </div>
              </div>

              {/* Action Buttons for Client Review */}
              <div className="p-4 rounded-xl bg-zinc-900 border border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  variant="primary"
                  onClick={() => setReviewAction('approve')}
                  className="bg-emerald-600 hover:bg-emerald-500 font-bold"
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Approve Deliverable
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReviewAction('revision')}
                  className="text-amber-300 border-amber-500/30 hover:bg-amber-500/10 font-bold"
                  leftIcon={<AlertTriangle className="w-4 h-4" />}
                >
                  Request Revision
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReviewAction('reject')}
                  className="text-rose-300 border-rose-500/30 hover:bg-rose-500/10 font-bold"
                  leftIcon={<ShieldAlert className="w-4 h-4" />}
                >
                  Reject Deliverable
                </Button>
              </div>
            </div>

            {/* Review History Audit Trail */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Approval Decision Cycles ({approvalsList.length})
              </h4>

              {approvalsList.length === 0 ? (
                <p className="text-xs text-zinc-500 italic p-4 rounded-xl border border-white/5">
                  No approval decision cycles recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {approvalsList.map((app) => (
                    <div key={app.id} className="p-4 rounded-xl bg-zinc-950 border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ApprovalBadge status={app.status} size="sm" />
                          <span className="text-xs font-bold text-white">{app.reviewerName}</span>
                          <span className="text-[10px] font-mono text-zinc-500">({app.version})</span>
                        </div>
                        <span className="text-[11px] text-zinc-500">{app.timestamp}</span>
                      </div>
                      {app.notes && <p className="text-xs text-zinc-300 italic">&quot;{app.notes}&quot;</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. THREADED COMMENTS TAB */}
        {activeTab === 'comments' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Add Comment / Note
              </h3>

              <form onSubmit={handleAddComment} className="space-y-3">
                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Type a feedback comment or internal note..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternalComment}
                      onChange={(e) => setIsInternalComment(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-amber-500"
                    />
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Internal note (hidden from client)</span>
                  </label>

                  <Button variant="primary" size="sm" type="submit" leftIcon={<Send className="w-3.5 h-3.5" />}>
                    Post Comment
                  </Button>
                </div>
              </form>
            </div>

            {/* Comments List */}
            <div className="space-y-3">
              {commentsList.length === 0 ? (
                <p className="text-xs text-zinc-500 italic p-6 text-center">No comments logged yet.</p>
              ) : (
                commentsList.map((comm) => (
                  <div
                    key={comm.id}
                    className={`p-4 rounded-xl border ${
                      comm.isInternal
                        ? 'bg-amber-500/[0.03] border-amber-500/20'
                        : 'bg-zinc-950/80 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{comm.author}</span>
                        {comm.isInternal && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold">
                            Internal Note
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500">{comm.timestamp}</span>
                    </div>
                    <p className="text-xs text-zinc-200">{comm.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 6. REVISIONS TAB */}
        {activeTab === 'revisions' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Revision Request History ({revisionsList.length})</span>
            </h3>

            {revisionsList.length === 0 ? (
              <p className="text-xs text-zinc-500 italic p-6 text-center border border-white/5 rounded-xl">
                No formal revision requests logged for this deliverable.
              </p>
            ) : (
              <div className="space-y-3">
                {revisionsList.map((rev) => (
                  <div key={rev.id} className="p-4 rounded-xl bg-zinc-950 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-300">
                        Revision #{rev.revisionNumber} ({rev.linkedVersion})
                      </span>
                      <span className="text-zinc-500">Requested {rev.requestedDate}</span>
                    </div>
                    <p className="text-xs text-zinc-200">&quot;{rev.reason}&quot;</p>
                    <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-2 border-t border-white/5">
                      <span>Requested by: {rev.requestedBy}</span>
                      <span className="capitalize font-semibold text-zinc-400">Status: {rev.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 7. TIMELINE TAB */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Visual Delivery Timeline</span>
            </h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
              {timelineList.map((item) => (
                <div key={item.id} className="relative flex items-start gap-4">
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-zinc-900 border border-white/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{item.title}</h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {item.timestamp} • By {item.actor}
                    </p>
                    {item.metadata && (
                      <p className="text-xs text-zinc-500 italic mt-1 bg-white/[0.02] p-2 rounded-lg border border-white/5">
                        {item.metadata}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. ACTIVITY LOG TAB */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              <span>Granular Audit Log</span>
            </h3>

            <div className="space-y-2">
              {activityList.map((act) => (
                <div
                  key={act.id}
                  className="p-3 rounded-xl bg-zinc-950 border border-white/5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-zinc-500" />
                    <div>
                      <span className="font-semibold text-white">{act.user}</span>{' '}
                      <span className="text-zinc-400">{act.action}</span>
                      {act.details && <p className="text-[11px] text-zinc-500">{act.details}</p>}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">{act.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. INTERNAL NOTES TAB */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Internal Freelancer Notes (Hidden from Client)</span>
              </h3>

              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveInternalNotes}
                isLoading={isSavingNotes}
              >
                Save Notes
              </Button>
            </div>

            <textarea
              rows={8}
              value={internalNotesText}
              onChange={(e) => setInternalNotesText(e.target.value)}
              placeholder="Keep track of secret keys, Figma frame node IDs, export settings..."
              className="w-full p-4 rounded-2xl bg-zinc-900 border border-white/10 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-white/30"
            />
          </div>
        )}
      </div>

      {/* SUB MODALS */}

      {/* Add New Version Modal */}
      {isAddVersionOpen && (
        <Modal
          isOpen={isAddVersionOpen}
          onClose={() => setIsAddVersionOpen(false)}
          title="Publish New Deliverable Version"
        >
          <form onSubmit={handleCreateVersion} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                New Version Tag *
              </label>
              <input
                type="text"
                value={newVersionTag}
                onChange={(e) => setNewVersionTag(e.target.value)}
                placeholder="e.g. v1.1.0"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Release Notes / Changelog
              </label>
              <textarea
                rows={3}
                value={newVersionNote}
                onChange={(e) => setNewVersionNote(e.target.value)}
                placeholder="Describe changes, fixes, or additions in this release..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Asset Package File Name
              </label>
              <input
                type="text"
                value={newVersionFileName}
                onChange={(e) => setNewVersionFileName(e.target.value)}
                placeholder="e.g. deliverable-v1.1.0.zip"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" type="button" onClick={() => setIsAddVersionOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Publish Release
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Attach File Modal */}
      {isAddFileOpen && (
        <Modal
          isOpen={isAddFileOpen}
          onClose={() => setIsAddFileOpen(false)}
          title="Attach File to Deliverable"
        >
          <form onSubmit={handleAddFile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                File Name *
              </label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="e.g. figma-tokens.json"
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  File Size
                </label>
                <input
                  type="text"
                  value={newFileSize}
                  onChange={(e) => setNewFileSize(e.target.value)}
                  placeholder="2.4 MB"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Folder
                </label>
                <input
                  type="text"
                  value={newFileFolder}
                  onChange={(e) => setNewFileFolder(e.target.value)}
                  placeholder="Root"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" type="button" onClick={() => setIsAddFileOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Attach File
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Client Sign-off Review Modal */}
      {reviewAction && (
        <Modal
          isOpen={!!reviewAction}
          onClose={() => setReviewAction(null)}
          title={`Confirm Client Review: ${reviewAction.toUpperCase()}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-300">
              You are recording formal client review feedback for &quot;{deliverable.title}&quot;.
            </p>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Review Notes & Feedback
              </label>
              <textarea
                rows={4}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Add sign-off notes or revision instructions..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <Button variant="outline" onClick={() => setReviewAction(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSubmitReview}>
                Submit Review Decision
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Compare Versions Modal */}
      {compareVersions && (
        <Modal
          isOpen={!!compareVersions}
          onClose={() => setCompareVersions(null)}
          title={`Version Comparison (${compareVersions.v1.version} vs ${compareVersions.v2.version})`}
          size="lg"
        >
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-zinc-900 border border-white/10 space-y-2">
              <h4 className="font-bold text-zinc-300">{compareVersions.v1.version} (Previous)</h4>
              <p className="text-zinc-400">{compareVersions.v1.note}</p>
              <p className="text-[10px] text-zinc-500 font-mono">Date: {compareVersions.v1.date}</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <h4 className="font-bold text-emerald-300">{compareVersions.v2.version} (Newer)</h4>
              <p className="text-emerald-100">{compareVersions.v2.note}</p>
              <p className="text-[10px] text-emerald-400 font-mono">Date: {compareVersions.v2.date}</p>
            </div>
          </div>
        </Modal>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <Modal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          title={`File Preview: ${previewFile.fileName}`}
          size="lg"
        >
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 mx-auto">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{previewFile.fileName}</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Size: {previewFile.fileSize} • Type: {previewFile.fileType}
              </p>
            </div>
            <div className="pt-4">
              <a
                href={previewFile.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-xs hover:bg-emerald-400 transition-colors"
              >
                <Download className="w-4 h-4" /> Download File Package
              </a>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
};
