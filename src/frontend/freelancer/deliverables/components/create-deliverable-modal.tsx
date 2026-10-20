import React, { useState } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { Input } from '@/frontend/shared/ui/input';
import { Button } from '@/frontend/shared/ui/button';
import { Client, Project, DeliverablePriority, DeliverableNiche, DeliverableNicheMetadata } from '@/shared/types';
import {
  Layers,
  Calendar,
  FileText,
  Lock,
  MessageSquare,
  AlertCircle,
  Code2,
  Palette,
  Video,
  Share2,
  Search,
  PenTool,
  Briefcase,
  GitBranch,
  GitPullRequest,
  ExternalLink,
  CheckSquare,
} from 'lucide-react';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Freelancer Niche & Specialized Fields
  const [niche, setNiche] = useState<DeliverableNiche>('general');

  // Software Development
  const [repoUrl, setRepoUrl] = useState('');
  const [branchName, setBranchName] = useState('');
  const [prUrl, setPrUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [technicalStatus, setTechnicalStatus] = useState<'in_development' | 'code_review' | 'qa_testing' | 'deployed' | 'ready_for_review'>('ready_for_review');

  // Graphic Design
  const [designPreviewUrl, setDesignPreviewUrl] = useState('');
  const [designTool, setDesignTool] = useState('Figma');
  const [exportFormats, setExportFormats] = useState('PNG, SVG, PDF');
  const [designRevisionRound, setDesignRevisionRound] = useState('1');

  // Video Editing
  const [videoPreviewUrl, setVideoPreviewUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('1080p');
  const [videoExportFormat, setVideoExportFormat] = useState('MP4');
  const [videoDownloadUrl, setVideoDownloadUrl] = useState('');

  // Social Media
  const [socialPlatform, setSocialPlatform] = useState('Instagram');
  const [socialContentType, setSocialContentType] = useState('Carousel');
  const [campaignName, setCampaignName] = useState('');
  const [assetCount, setAssetCount] = useState('1');
  const [plannedPublishDate, setPlannedPublishDate] = useState('');
  const [socialPreviewUrl, setSocialPreviewUrl] = useState('');
  const [publishingUrl, setPublishingUrl] = useState('');

  // SEO & Marketing
  const [seoDeliverableType, setSeoDeliverableType] = useState('Monthly SEO Report');
  const [seoReportingPeriod, setSeoReportingPeriod] = useState('');
  const [seoReportUrl, setSeoReportUrl] = useState('');
  const [seoAuditType, setSeoAuditType] = useState('Technical SEO Audit');
  const [seoCompletedWork, setSeoCompletedWork] = useState('');

  // Writing & Copywriting
  const [writingContentType, setWritingContentType] = useState('Article / Blog Post');
  const [writingDocUrl, setWritingDocUrl] = useState('');
  const [writingLanguage, setWritingLanguage] = useState('English');
  const [wordCount, setWordCount] = useState('');
  const [writingRevisionRound, setWritingRevisionRound] = useState('1');

  // Consulting & Virtual Assistance
  const [consultingType, setConsultingType] = useState('Executive Brief / SOP');
  const [consultingPeriod, setConsultingPeriod] = useState('');
  const [consultingDocUrl, setConsultingDocUrl] = useState('');
  const [consultingSummary, setConsultingSummary] = useState('');
  const [consultingSignOff, setConsultingSignOff] = useState(true);

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
    switch (niche) {
      case 'software_development':
        return {
          repositoryUrl: repoUrl.trim() || undefined,
          branchName: branchName.trim() || undefined,
          pullRequestUrl: prUrl.trim() || undefined,
          releaseVersion: version || undefined,
          previewUrl: previewUrl.trim() || undefined,
          technicalStatus,
          buildStatus: 'not_connected',
        };
      case 'graphic_design':
        return {
          designPreviewUrl: designPreviewUrl.trim() || undefined,
          designTool: designTool.trim() || undefined,
          versionNumber: version || undefined,
          exportFormats: exportFormats ? exportFormats.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
          revisionRound: designRevisionRound || '1',
        };
      case 'video_editing':
        return {
          videoPreviewUrl: videoPreviewUrl.trim() || undefined,
          duration: videoDuration.trim() || undefined,
          aspectRatio: aspectRatio || undefined,
          resolution: resolution || undefined,
          exportFormat: videoExportFormat || undefined,
          versionNumber: version || undefined,
          finalDownloadUrl: videoDownloadUrl.trim() || undefined,
        };
      case 'social_media':
        return {
          platform: socialPlatform || undefined,
          contentType: socialContentType || undefined,
          campaignName: campaignName.trim() || undefined,
          assetCount: assetCount ? parseInt(assetCount, 10) : undefined,
          plannedPublishDate: plannedPublishDate || undefined,
          previewUrl: socialPreviewUrl.trim() || undefined,
          publishingUrl: publishingUrl.trim() || undefined,
        };
      case 'seo_marketing':
        return {
          deliverableType: seoDeliverableType || undefined,
          reportingPeriod: seoReportingPeriod.trim() || undefined,
          reportUrl: seoReportUrl.trim() || undefined,
          auditType: seoAuditType || undefined,
          completedWorkSummary: seoCompletedWork.trim() || undefined,
        };
      case 'writing_translation':
        return {
          contentType: writingContentType || undefined,
          documentUrl: writingDocUrl.trim() || undefined,
          language: writingLanguage.trim() || undefined,
          wordCount: wordCount ? parseInt(wordCount, 10) : undefined,
          versionNumber: version || undefined,
          revisionRound: writingRevisionRound || '1',
        };
      case 'consulting_va':
        return {
          deliverableType: consultingType || undefined,
          reportingPeriod: consultingPeriod.trim() || undefined,
          documentUrl: consultingDocUrl.trim() || undefined,
          completionSummary: consultingSummary.trim() || undefined,
          clientSignOffRequired: consultingSignOff,
        };
      default:
        return {};
    }
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
        fileUrl: fileUrl || (selectedFile ? '' : `https://flowdesk.app/deliverables/${title.toLowerCase().replace(/\s+/g, '-')}`),
        file: selectedFile || undefined,
        internalNotes: internalNotes.trim(),
        submissionMessage: submissionMessage.trim(),
        status: 'draft' as const,
        approvalStatus: 'pending' as const,
        niche,
        nicheMetadata: buildNicheMetadata(),
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
    setSelectedFile(null);
    setInternalNotes('');
    setSubmissionMessage('');
    setFileError(null);
    setNiche('general');
    setRepoUrl('');
    setBranchName('');
    setPrUrl('');
    setPreviewUrl('');
    setDesignPreviewUrl('');
    setDesignTool('Figma');
    setExportFormats('PNG, SVG, PDF');
    setDesignRevisionRound('1');
    setVideoPreviewUrl('');
    setVideoDuration('');
    setAspectRatio('16:9');
    setResolution('1080p');
    setVideoExportFormat('MP4');
    setVideoDownloadUrl('');
    setSocialPlatform('Instagram');
    setSocialContentType('Carousel');
    setCampaignName('');
    setAssetCount('1');
    setPlannedPublishDate('');
    setSocialPreviewUrl('');
    setPublishingUrl('');
    setSeoDeliverableType('Monthly SEO Report');
    setSeoReportingPeriod('');
    setSeoReportUrl('');
    setSeoAuditType('Technical SEO Audit');
    setSeoCompletedWork('');
    setWritingContentType('Article / Blog Post');
    setWritingDocUrl('');
    setWritingLanguage('English');
    setWordCount('');
    setWritingRevisionRound('1');
    setConsultingType('Executive Brief / SOP');
    setConsultingPeriod('');
    setConsultingDocUrl('');
    setConsultingSummary('');
    setConsultingSignOff(true);
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

        {/* Freelancer Niche / Template Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Freelancer Niche Template</span>
            </label>
            <span className="text-[11px] text-zinc-500">Reveals specialized fields for your discipline</span>
          </div>
          <select
            value={niche}
            onChange={(e) => setNiche(e.target.value as DeliverableNiche)}
            className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white focus:outline-none focus:border-white/30"
          >
            <option value="general">General / Standard Asset</option>
            <option value="software_development">💻 Software Development & Code</option>
            <option value="graphic_design">🎨 Graphic & Brand Design</option>
            <option value="video_editing">🎬 Video Editing & Motion Graphics</option>
            <option value="social_media">📱 Social Media & Content Creation</option>
            <option value="seo_marketing">📈 SEO & Digital Marketing</option>
            <option value="writing_translation">✍️ Writing, Copy & Translation</option>
            <option value="consulting_va">💼 Consulting & Virtual Assistance</option>
          </select>
        </div>

        {/* Specialized Niche Fields */}
        {niche === 'software_development' && (
          <div className="p-4 rounded-xl bg-blue-500/[0.04] border border-blue-500/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                <Code2 className="w-4 h-4 text-blue-400" />
                <span>Software Developer Specifications</span>
              </div>
              <span className="text-[10px] text-zinc-400">GitHub optional • Standard files supported</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Repository URL"
                placeholder="https://github.com/org/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
              <Input
                label="Branch Name"
                placeholder="main or feature/deliverable-v1"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
              <Input
                label="Pull Request URL"
                placeholder="https://github.com/org/repo/pull/42"
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
              />
              <Input
                label="Preview / Deployment URL"
                placeholder="https://staging.app.com or Vercel preview"
                value={previewUrl}
                onChange={(e) => setPreviewUrl(e.target.value)}
              />
            </div>
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
          </div>
        )}

        {niche === 'graphic_design' && (
          <div className="p-4 rounded-xl bg-purple-500/[0.04] border border-purple-500/20 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
              <Palette className="w-4 h-4 text-purple-400" />
              <span>Graphic & Brand Design Specifications</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Design Preview URL"
                placeholder="https://figma.com/file/... or Adobe XD"
                value={designPreviewUrl}
                onChange={(e) => setDesignPreviewUrl(e.target.value)}
              />
              <Input
                label="Design Tool / Source"
                placeholder="e.g. Figma, Illustrator, Photoshop"
                value={designTool}
                onChange={(e) => setDesignTool(e.target.value)}
              />
              <Input
                label="Export Formats Included"
                placeholder="e.g. SVG, PNG 2x, PDF, AI"
                value={exportFormats}
                onChange={(e) => setExportFormats(e.target.value)}
              />
              <Input
                label="Revision Round"
                placeholder="e.g. Round 1"
                value={designRevisionRound}
                onChange={(e) => setDesignRevisionRound(e.target.value)}
              />
            </div>
          </div>
        )}

        {niche === 'video_editing' && (
          <div className="p-4 rounded-xl bg-rose-500/[0.04] border border-rose-500/20 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
              <Video className="w-4 h-4 text-rose-400" />
              <span>Video & Motion Specifications</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Video Preview URL"
                placeholder="https://vimeo.com/... or Frame.io"
                value={videoPreviewUrl}
                onChange={(e) => setVideoPreviewUrl(e.target.value)}
              />
              <Input
                label="Final Download URL"
                placeholder="https://drive.google.com/... or WeTransfer"
                value={videoDownloadUrl}
                onChange={(e) => setVideoDownloadUrl(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Duration"
                  placeholder="e.g. 02:45"
                  value={videoDuration}
                  onChange={(e) => setVideoDuration(e.target.value)}
                />
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Aspect Ratio
                  </label>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="16:9">16:9 (Landscape)</option>
                    <option value="9:16">9:16 (Vertical / Reels)</option>
                    <option value="1:1">1:1 (Square)</option>
                    <option value="4:5">4:5 (Portrait)</option>
                    <option value="21:9">21:9 (Ultrawide)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Resolution
                  </label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="4K (3840x2160)">4K UHD</option>
                    <option value="1080p (1920x1080)">1080p Full HD</option>
                    <option value="2K (2560x1440)">2K QHD</option>
                    <option value="720p">720p HD</option>
                  </select>
                </div>
                <Input
                  label="Format"
                  placeholder="e.g. MP4 (H.264), ProRes"
                  value={videoExportFormat}
                  onChange={(e) => setVideoExportFormat(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {niche === 'social_media' && (
          <div className="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <Share2 className="w-4 h-4 text-amber-400" />
              <span>Social Media & Content Campaign</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Target Platform
                </label>
                <select
                  value={socialPlatform}
                  onChange={(e) => setSocialPlatform(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-white/30"
                >
                  <option value="Instagram">Instagram</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="X (Twitter)">X (Twitter)</option>
                  <option value="TikTok">TikTok</option>
                  <option value="YouTube">YouTube</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Pinterest">Pinterest</option>
                  <option value="Multi-Platform">Multi-Platform</option>
                </select>
              </div>
              <Input
                label="Content Type"
                placeholder="e.g. Carousel, Reel, Story, Thread"
                value={socialContentType}
                onChange={(e) => setSocialContentType(e.target.value)}
              />
              <Input
                label="Campaign Association / Name"
                placeholder="e.g. Q4 Brand Relaunch"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Asset Count"
                  type="number"
                  placeholder="1"
                  value={assetCount}
                  onChange={(e) => setAssetCount(e.target.value)}
                />
                <Input
                  label="Planned Publish Date"
                  type="date"
                  value={plannedPublishDate}
                  onChange={(e) => setPlannedPublishDate(e.target.value)}
                />
              </div>
              <Input
                label="Preview URL"
                placeholder="e.g. Canva link, Figma, Notion draft"
                value={socialPreviewUrl}
                onChange={(e) => setSocialPreviewUrl(e.target.value)}
              />
              <Input
                label="Live Publishing URL (if live)"
                placeholder="https://instagram.com/p/..."
                value={publishingUrl}
                onChange={(e) => setPublishingUrl(e.target.value)}
              />
            </div>
          </div>
        )}

        {niche === 'seo_marketing' && (
          <div className="p-4 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <Search className="w-4 h-4 text-emerald-400" />
              <span>SEO & Digital Marketing Deliverable</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Deliverable / Report Type"
                placeholder="e.g. Monthly SEO Performance Report"
                value={seoDeliverableType}
                onChange={(e) => setSeoDeliverableType(e.target.value)}
              />
              <Input
                label="Reporting Period"
                placeholder="e.g. October 2026 or Q3 2026"
                value={seoReportingPeriod}
                onChange={(e) => setSeoReportingPeriod(e.target.value)}
              />
              <Input
                label="Report or Dashboard URL"
                placeholder="https://lookerstudio.google.com/... or GA4"
                value={seoReportUrl}
                onChange={(e) => setSeoReportUrl(e.target.value)}
              />
              <Input
                label="Audit / Analysis Type"
                placeholder="e.g. Technical Audit, Backlink Profile"
                value={seoAuditType}
                onChange={(e) => setSeoAuditType(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Work Completed Summary
              </label>
              <textarea
                rows={2}
                value={seoCompletedWork}
                onChange={(e) => setSeoCompletedWork(e.target.value)}
                placeholder="Key technical fixes implemented, backlinks built, ranking shifts..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
              />
            </div>
          </div>
        )}

        {niche === 'writing_translation' && (
          <div className="p-4 rounded-xl bg-teal-500/[0.04] border border-teal-500/20 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-300">
              <PenTool className="w-4 h-4 text-teal-400" />
              <span>Writing, Copy & Translation Specifications</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Content Type"
                placeholder="e.g. Long-form Article, Landing Page Copy"
                value={writingContentType}
                onChange={(e) => setWritingContentType(e.target.value)}
              />
              <Input
                label="Live Document URL"
                placeholder="https://docs.google.com/document/... or Notion"
                value={writingDocUrl}
                onChange={(e) => setWritingDocUrl(e.target.value)}
              />
              <Input
                label="Language"
                placeholder="e.g. English (US), Spanish (ES)"
                value={writingLanguage}
                onChange={(e) => setWritingLanguage(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Target / Word Count"
                  type="number"
                  placeholder="e.g. 1500"
                  value={wordCount}
                  onChange={(e) => setWordCount(e.target.value)}
                />
                <Input
                  label="Revision Round"
                  placeholder="e.g. Round 1"
                  value={writingRevisionRound}
                  onChange={(e) => setWritingRevisionRound(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {niche === 'consulting_va' && (
          <div className="p-4 rounded-xl bg-indigo-500/[0.04] border border-indigo-500/20 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
              <Briefcase className="w-4 h-4 text-indigo-400" />
              <span>Consulting & Virtual Assistance</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Deliverable Type"
                placeholder="e.g. Executive Summary, Process SOP, Audit"
                value={consultingType}
                onChange={(e) => setConsultingType(e.target.value)}
              />
              <Input
                label="Reporting Period"
                placeholder="e.g. Week 42, Oct 2026"
                value={consultingPeriod}
                onChange={(e) => setConsultingPeriod(e.target.value)}
              />
              <div className="md:col-span-2">
                <Input
                  label="Supporting Document / Drive URL"
                  placeholder="https://drive.google.com/... or Notion workspace"
                  value={consultingDocUrl}
                  onChange={(e) => setConsultingDocUrl(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Completion Summary & Key Takeaways
              </label>
              <textarea
                rows={2}
                value={consultingSummary}
                onChange={(e) => setConsultingSummary(e.target.value)}
                placeholder="Summary of advisory outcomes, checklist items finished, recommendations..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={consultingSignOff}
                onChange={(e) => setConsultingSignOff(e.target.checked)}
                className="rounded bg-zinc-900 border-white/20 text-indigo-500 focus:ring-0"
              />
              <span>Formal Client Sign-Off Required for Milestone Completion</span>
            </label>
          </div>
        )}

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
