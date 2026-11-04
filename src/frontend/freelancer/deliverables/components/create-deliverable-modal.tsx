import React, { useState } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { Input } from '@/frontend/shared/ui/input';
import { Button } from '@/frontend/shared/ui/button';
import { Client, Project, DeliverablePriority, DeliverableNiche, DeliverableNicheMetadata } from '@/shared/types';
import {
  Layers,
  FileText,
  Code2,
  Briefcase,
  CheckCircle2,
  Lock,
  MessageSquare,
  Eye,
  Image as ImageIcon,
} from 'lucide-react';

import { useAuth } from '@/frontend/auth/auth-context';
import { FreelancerClientService, FreelancerProjectService, FreelancerDeliverableService } from '@/backend/freelancer';
import { useToast } from '@/frontend/shared/ui/toast';

interface CreateDeliverableModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients?: Client[];
  projects?: Project[];
  defaultClientId?: string;
  defaultProjectId?: string;
  onCreate?: (delData: any) => Promise<void>;
  onSuccess?: (created: any) => void;
}

export const CreateDeliverableModal: React.FC<CreateDeliverableModalProps> = ({
  isOpen,
  onClose,
  clients: propClients,
  projects: propProjects,
  defaultClientId,
  defaultProjectId,
  onCreate,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [fetchedClients, setFetchedClients] = useState<Client[]>([]);
  const [fetchedProjects, setFetchedProjects] = useState<Project[]>([]);
  const clients = propClients && propClients.length > 0 ? propClients : fetchedClients;
  const projects = propProjects && propProjects.length > 0 ? propProjects : fetchedProjects;

  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState(defaultClientId || '');
  const [projectId, setProjectId] = useState(defaultProjectId || '');

  React.useEffect(() => {
    if (defaultClientId) setClientId(defaultClientId);
  }, [defaultClientId]);

  React.useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId);
  }, [defaultProjectId]);

  React.useEffect(() => {
    if (isOpen) {
      if (!propClients || propClients.length === 0) {
        FreelancerClientService.getClients().then(setFetchedClients);
      }
      if (!propProjects || propProjects.length === 0) {
        FreelancerProjectService.getProjects().then(setFetchedProjects);
      }
    }
  }, [isOpen, propClients, propProjects]);
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
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { userSettings } = useAuth();
  const [internalNotes, setInternalNotes] = useState('');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Freelancer Niche & Specialized Fields (Software Developer vs Others)
  const [niche, setNiche] = useState<DeliverableNiche>(() => {
    return userSettings?.default_deliverable_niche || 'software_development';
  });

  React.useEffect(() => {
    if (isOpen && userSettings?.default_deliverable_niche) {
      setNiche(userSettings.default_deliverable_niche);
    }
  }, [isOpen, userSettings?.default_deliverable_niche]);

  // Project & Development Fields (Available across deliverables)
  const [repoUrl, setRepoUrl] = useState('');
  const [branchName, setBranchName] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [technicalStatus, setTechnicalStatus] = useState<'in_development' | 'code_review' | 'qa_testing' | 'deployed' | 'ready_for_review'>('ready_for_review');

  const effectiveClientId = clientId || defaultClientId || clients[0]?.id || '';
  const availableProjects = projects.filter((p) => p.clientId === effectiveClientId);
  const effectiveProjectId = projectId || defaultProjectId || availableProjects[0]?.id || projects[0]?.id || '';

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const buildNicheMetadata = (): DeliverableNicheMetadata => {
    return {
      repositoryUrl: repoUrl.trim() || undefined,
      repoUrl: repoUrl.trim() || undefined,
      previewUrl: previewUrl.trim() || undefined,
      projectUrl: previewUrl.trim() || undefined,
      liveProjectUrl: previewUrl.trim() || undefined,
      previewImageUrl: previewImageUrl.trim() || undefined,
      branchName: branchName.trim() || undefined,
      pullRequestUrl: prUrl.trim() || undefined,
      releaseVersion: version || undefined,
      technicalStatus,
      buildStatus: 'not_connected',
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Validate file size (50MB limit)
    if (selectedFile && selectedFile.size > 50 * 1024 * 1024) {
      return; // File too large - UI should show error
    }

    setIsSubmitting(true);
    try {
      const resolvedFileUrl = fileUrl.trim() || (selectedFile && selectedFile.type.startsWith('image/') ? previewImageUrl : '') || previewImageUrl.trim() || (selectedFile ? '' : `https://flowdesk.app/deliverables/${title.toLowerCase().replace(/\s+/g, '-')}`);

      const payload = {
        clientId: effectiveClientId || 'cli-1',
        projectId: effectiveProjectId || 'proj-1',
        title: title.trim(),
        description: description.trim(),
        dueDate,
        reviewDeadline,
        version: version || 'v1.0.0',
        priority,
        fileName: fileName || (selectedFile ? selectedFile.name : `${title.toLowerCase().replace(/\s+/g, '-')}-v1.pdf`),
        fileSize: selectedFile ? formatFileSize(selectedFile.size) : (fileSize || '3.5 MB'),
        fileUrl: resolvedFileUrl,
        previewImageUrl: previewImageUrl.trim() || (resolvedFileUrl.startsWith('data:image/') || /\.(png|jpe?g|webp|gif|svg)($|\?)/i.test(resolvedFileUrl) ? resolvedFileUrl : undefined),
        file: selectedFile || undefined,
        internalNotes: internalNotes.trim(),
        submissionMessage: submissionMessage.trim(),
        status: 'draft' as const,
        approvalStatus: 'pending' as const,
        previewUrl: previewUrl.trim() || undefined,
        repoUrl: repoUrl.trim() || undefined,
        niche,
        nicheMetadata: {
          ...buildNicheMetadata(),
          githubUrl: repoUrl.trim() || undefined,
        },
      };

      if (onCreate) {
        await onCreate(payload);
      } else {
        const created = await FreelancerDeliverableService.addDeliverable(payload);
        showToast('Deliverable Package Created', `"${title.trim()}" is ready for client review.`, 'success');
        if (onSuccess) onSuccess(created);
      }
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Create deliverable error:', err);
      setFileError(err?.message || 'Failed to create deliverable package.');
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
    setPreviewImageUrl('');
    setSelectedFile(null);
    setInternalNotes('');
    setSubmissionMessage('');
    setFileError(null);
    setNiche(userSettings?.default_deliverable_niche || 'software_development');
    setRepoUrl('');
    setBranchName('');
    setPrUrl('');
    setPreviewUrl('');
    setTechnicalStatus('ready_for_review');
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
            maxLength={255}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Client Account *
            </label>
            <select
              value={effectiveClientId}
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
              value={effectiveProjectId}
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
            maxLength={2000}
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Freelancer Niche Selector (2 Options: Software Developer vs Others) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#43D6B0]" />
              <span>Deliverable Workflow Type</span>
            </label>
            <span className="text-[11px] text-zinc-500">Configure workflow fields for your deliverable</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Software Developer Option */}
            <button
              type="button"
              onClick={() => setNiche('software_development')}
              className={`p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                niche === 'software_development'
                  ? 'bg-[#176B5B]/15 border-[#176B5B] shadow-[0_0_15px_rgba(23,107,91,0.2)] ring-1 ring-[#43D6B0]/50'
                  : 'bg-[#191F1D] border-[#176B5B]/30 hover:border-[#176B5B]/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${
                      niche === 'software_development' ? 'bg-[#176B5B]/30 text-[#43D6B0]' : 'bg-white/5 text-[#A6B4AE]'
                    }`}>
                      <Code2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-[#F5F5F0]">Software Developer</span>
                  </div>
                  {niche === 'software_development' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#43D6B0]" />
                  )}
                </div>
                <p className="text-[11px] text-[#A6B4AE] leading-relaxed">
                  Reveals technical fields: repository URL, branch, pull request, and deployment preview.
                </p>
              </div>
            </button>

            {/* Others Option */}
            <button
              type="button"
              onClick={() => setNiche('others')}
              className={`p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                niche !== 'software_development'
                  ? 'bg-[#176B5B]/15 border-[#176B5B] shadow-[0_0_15px_rgba(23,107,91,0.2)] ring-1 ring-[#43D6B0]/50'
                  : 'bg-[#191F1D] border-[#176B5B]/30 hover:border-[#176B5B]/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${
                      niche !== 'software_development' ? 'bg-[#176B5B]/30 text-[#43D6B0]' : 'bg-white/5 text-[#A6B4AE]'
                    }`}>
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-semibold text-[#F5F5F0]">Others</span>
                  </div>
                  {niche !== 'software_development' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#43D6B0]" />
                  )}
                </div>
                <p className="text-[11px] text-[#A6B4AE] leading-relaxed">
                  Standard workflow for design, video, copy, marketing, consulting, and all creative services.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Project Links & Repository Details (Always available & client-facing) */}
        <div className="p-4 rounded-xl bg-[#176B5B]/10 border border-[#176B5B]/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#43D6B0]">
              <Code2 className="w-4 h-4 text-[#43D6B0]" />
              <span>Project Details & Deployment Links (Client Facing)</span>
            </div>
            <span className="text-[10px] text-zinc-400">Live preview & repository links</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Live Project / Preview URL"
              placeholder="https://staging.example.com, Figma, or demo"
              value={previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
            />
            <Input
              label="Repository URL (e.g. GitHub)"
              placeholder="https://github.com/organization/repository"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
            <Input
              label="Branch Name (Optional)"
              placeholder="main, production, or feature-v1"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
            />
            <Input
              label="Pull Request URL (Optional)"
              placeholder="https://github.com/organization/repo/pull/42"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
            />
          </div>
          {niche === 'software_development' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Technical Build / Review Status
              </label>
              <select
                value={technicalStatus}
                onChange={(e) => setTechnicalStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
              >
                <option value="ready_for_review">Ready for Review / Staged</option>
                <option value="deployed">Deployed to Production / Staging</option>
                <option value="code_review">In Code Review / PR Open</option>
                <option value="qa_testing">QA & Acceptance Testing</option>
                <option value="in_development">In Active Development</option>
              </select>
            </div>
          )}
        </div>

        {/* Deliverable Preview Image / Visual Showcase */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <Eye className="w-4 h-4 text-[#43D6B0]" />
              <span>Deliverable Preview Image / Screenshot</span>
            </div>
            <span className="text-[10px] text-zinc-400">Rendered on client portal</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Upload Preview Image
              </label>
              <input
                type="file"
                id="deliverable-preview-image-upload"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === 'string') {
                        setPreviewImageUrl(reader.result);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <label
                htmlFor="deliverable-preview-image-upload"
                className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-white/20 hover:border-[#43D6B0]/50 rounded-xl bg-zinc-900 text-xs text-zinc-300 cursor-pointer transition-colors"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#43D6B0]" />
                <span>Select Screenshot or Graphic Image</span>
              </label>
            </div>

            <Input
              label="Or Paste Preview Image URL"
              placeholder="https://.../preview.png or image link"
              value={previewImageUrl.startsWith('data:') ? '(Image file uploaded)' : previewImageUrl}
              onChange={(e) => setPreviewImageUrl(e.target.value)}
              disabled={previewImageUrl.startsWith('data:')}
            />
          </div>

          {/* Live Preview of the Image */}
          {previewImageUrl && (
            <div className="relative mt-2 p-2.5 rounded-xl bg-black/40 border border-[#43D6B0]/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 overflow-hidden">
                <img
                  src={previewImageUrl}
                  alt="Deliverable Preview"
                  className="w-16 h-12 object-cover rounded-lg border border-white/10 shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-[#43D6B0] block">Preview Image Active</span>
                  <span className="text-[10px] text-zinc-400 block truncate">
                    Ready to display to the client in the portal
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImageUrl('')}
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 rounded hover:bg-rose-500/10 shrink-0"
              >
                Clear
              </button>
            </div>
          )}
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

        {/* File Upload section */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Primary Asset File Attachment</span>
          </div>
          
          {/* Real file upload input */}
          <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-emerald-400/50 transition-colors">
            <input
              type="file"
              id="deliverable-file-upload"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 50 * 1024 * 1024) {
                    setFileError('File exceeds 50MB limit. Please select a smaller file.');
                    return;
                  }
                  setFileError(null);
                  setSelectedFile(file);
                  setFileName(file.name);
                  setFileSize(formatFileSize(file.size));
                  if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === 'string') {
                        setPreviewImageUrl(reader.result);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }
              }}
              accept=".pdf,.zip,.rar,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.svg,.figma,.sketch"
            />
            <label
              htmlFor="deliverable-file-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <FileText className="w-8 h-8 text-zinc-500" />
              <span className="text-xs text-zinc-400">
                {selectedFile ? selectedFile.name : 'Click to select file or drag & drop'}
              </span>
              <span className="text-[10px] text-zinc-500">
                PDF, ZIP, DOC, Images, Figma files up to 50MB
              </span>
            </label>
          </div>

          {/* Show selected file info */}
          {fileError && (
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {fileError}
            </div>
          )}

          {selectedFile && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-300 font-medium">{selectedFile.name}</span>
                <span className="text-[10px] text-zinc-500">({formatFileSize(selectedFile.size)})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setFileName('');
                  setFileSize('3.5 MB');
                }}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Remove
              </button>
            </div>
          )}

          {/* Fallback URL input for remote files */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Or paste download URL (optional)"
              placeholder="https://figma.com/file/..."
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
            />
            <Input
              label="File Size (auto-filled)"
              placeholder="e.g., 4.5 MB"
              value={fileSize}
              onChange={(e) => setFileSize(e.target.value)}
              disabled={!!selectedFile}
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
