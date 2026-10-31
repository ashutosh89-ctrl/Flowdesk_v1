'use client';

import React, { useState } from 'react';
import { Card } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { StatusPill } from '@/frontend/shared/ui/status-pill';
import { Deliverable } from '@/shared/types';
import {
  CheckSquare,
  FileText,
  Download,
  Eye,
  History,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Code2,
  GitBranch,
  GitPullRequest,
  Globe,
  X,
  ZoomIn,
  Image as ImageIcon,
} from 'lucide-react';

import { isSafeHttpUrl } from '@/shared/utils/safe-url';

interface DeliverablesPanelProps {
  deliverables: Deliverable[];
  onApproveClick: (deliv: Deliverable) => void;
  onRequestRevisionClick: (deliv: Deliverable) => void;
  onDownloadClick: (deliv: Deliverable) => void;
}

export const DeliverablesPanel: React.FC<DeliverablesPanelProps> = ({
  deliverables,
  onApproveClick,
  onRequestRevisionClick,
  onDownloadClick,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'revision'>('all');
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string } | null>(null);

  const filteredDeliverables = deliverables.filter((d) => {
    if (filter === 'pending') return d.status === 'ready_for_review' || d.status === 'submitted' || d.status === 'preparing';
    if (filter === 'approved') return d.status === 'approved' || d.status === 'completed';
    if (filter === 'revision') return d.status === 'revision_requested';
    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Deliverables & Work Sign-Off</h2>
          <p className="text-xs text-zinc-400">Review assets, inspect live project links, repository code, and approve milestones</p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-white/10">
          {[
            { id: 'all', label: 'All Assets' },
            { id: 'pending', label: 'Needs Review' },
            { id: 'approved', label: 'Approved' },
            { id: 'revision', label: 'Revisions' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === tab.id
                  ? 'bg-white text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Deliverables List */}
      <div className="space-y-4">
        {filteredDeliverables.length === 0 ? (
          <Card variant="crystal" className="p-12 text-center space-y-3">
            <CheckSquare className="w-10 h-10 text-zinc-600 mx-auto" />
            <h3 className="text-base font-bold text-white">No Deliverables Found</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              There are no deliverables matching the selected filter criteria.
            </p>
          </Card>
        ) : (
          filteredDeliverables.map((deliv) => {
            const isVersionExpanded = expandedVersionId === deliv.id;
            const isApproved = deliv.status === 'approved' || deliv.status === 'completed';

            const meta = (deliv.nicheMetadata || {}) as Record<string, any>;
            
            // Extract Project URLs and Repository Links with fallback extraction
            const rawRepoUrl =
              deliv.repoUrl ||
              (deliv as any).githubUrl ||
              (deliv as any).repositoryUrl ||
              meta.repositoryUrl ||
              meta.repoUrl ||
              meta.githubUrl ||
              (() => {
                if (deliv.fileUrl && /github\.com/i.test(deliv.fileUrl)) return deliv.fileUrl;
                const match = `${deliv.description || ''} ${deliv.submissionMessage || ''}`.match(/https?:\/\/(www\.)?github\.com\/[^\s)\]]+/i);
                return match ? match[0] : null;
              })();

            const repoUrl = rawRepoUrl && isSafeHttpUrl(rawRepoUrl) ? rawRepoUrl : null;

            const liveProjectUrl = (() => {
              const url =
                deliv.previewUrl ||
                (deliv as any).liveProjectUrl ||
                (deliv as any).projectUrl ||
                meta.previewUrl ||
                meta.liveProjectUrl ||
                meta.projectUrl ||
                meta.deploymentUrl ||
                meta.designPreviewUrl ||
                meta.videoPreviewUrl ||
                meta.documentUrl ||
                meta.reportUrl ||
                meta.socialPreviewUrl ||
                meta.publishingUrl ||
                (() => {
                  if (
                    deliv.fileUrl &&
                    isSafeHttpUrl(deliv.fileUrl) &&
                    !/github\.com/i.test(deliv.fileUrl) &&
                    !/\.(pdf|zip|tar|rar|docx?|xlsx?)($|\?)/i.test(deliv.fileUrl) &&
                    !deliv.fileUrl.includes('/flowdesk.app/deliverables/')
                  ) {
                    return deliv.fileUrl;
                  }
                  const match = `${deliv.description || ''} ${deliv.submissionMessage || ''}`.match(/https?:\/\/[^\s)\]]+/i);
                  if (match && !/github\.com/i.test(match[0])) return match[0];
                  return null;
                })();
              return url && isSafeHttpUrl(url) ? url : null;
            })();
            const branchName = meta.branchName;
            const prUrl = meta.pullRequestUrl || meta.prUrl;

            // Extract Preview Image (uploaded base64 data, remote URL, or image file attachment)
            const previewImg = (() => {
              if (deliv.previewImageUrl && deliv.previewImageUrl.trim()) return deliv.previewImageUrl.trim();
              if (deliv.thumbnailUrl && deliv.thumbnailUrl.trim()) return deliv.thumbnailUrl.trim();
              if (meta.previewImageUrl && typeof meta.previewImageUrl === 'string') return meta.previewImageUrl.trim();
              if (meta.thumbnailUrl && typeof meta.thumbnailUrl === 'string') return meta.thumbnailUrl.trim();
              if (deliv.fileUrl) {
                if (deliv.fileUrl.startsWith('data:image/')) return deliv.fileUrl;
                if (/\.(png|jpe?g|webp|gif|svg)($|\?)/i.test(deliv.fileUrl)) return deliv.fileUrl;
              }
              return null;
            })();

            return (
              <Card key={deliv.id} variant="crystal" className="p-6 border-white/15 hover:border-white/25 transition-all space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-white">{deliv.title}</h3>
                      <span className="px-2 py-0.5 rounded bg-white/10 border border-white/15 text-[10px] font-mono text-zinc-300 font-bold">
                        {deliv.version || 'v1.0'}
                      </span>
                      <StatusPill status={deliv.status} />
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">{deliv.description}</p>
                    <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-400 pt-1 flex-wrap">
                      <span>Review Deadline: {deliv.dueDate}</span>
                      {deliv.fileSize && <span>Size: {deliv.fileSize}</span>}
                      {deliv.niche && deliv.niche !== 'general' && (
                        <span className="capitalize text-zinc-300">
                          Discipline: {deliv.niche.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {liveProjectUrl && (
                      <a
                        href={liveProjectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#43D6B0]/15 hover:bg-[#43D6B0]/25 text-[#43D6B0] border border-[#43D6B0]/30 transition-all shadow-sm"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Live Preview</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>
                    )}

                    {repoUrl && (
                      <a
                        href={repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white border border-white/20 transition-all shadow-sm"
                      >
                        <Code2 className="w-3.5 h-3.5 text-[#43D6B0]" />
                        <span>GitHub Repo</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </a>
                    )}

                    {deliv.fileUrl && deliv.fileUrl !== '#' && deliv.fileUrl !== '' && !deliv.fileUrl.startsWith('https://flowdesk.app/deliverables/') ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownloadClick(deliv)}
                        leftIcon={<Download className="w-3.5 h-3.5" />}
                      >
                        Download Asset
                      </Button>
                    ) : (
                      !liveProjectUrl && !repoUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          className="opacity-50 cursor-not-allowed"
                          leftIcon={<Download className="w-3.5 h-3.5 text-zinc-500" />}
                        >
                          File Unavailable
                        </Button>
                      )
                    )}

                    {!isApproved && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRequestRevisionClick(deliv)}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
                      >
                        Request Revision
                      </Button>
                    )}

                    {!isApproved ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onApproveClick(deliv)}
                        leftIcon={<CheckSquare className="w-3.5 h-3.5" />}
                      >
                        Approve Deliverable
                      </Button>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5" />
                        Signed Off
                      </span>
                    )}
                  </div>
                </div>

                {/* Deliverable Preview Image Card (Prominent & Scannable) */}
                {previewImg && (
                  <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                        <ImageIcon className="w-3.5 h-3.5 text-[#43D6B0]" />
                        <span>Visual Preview Showcase</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setLightboxImage({ src: previewImg, title: deliv.title })}
                        className="inline-flex items-center gap-1 text-[11px] text-[#43D6B0] hover:underline"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>Expand Fullscreen</span>
                      </button>
                    </div>

                    <div
                      onClick={() => setLightboxImage({ src: previewImg, title: deliv.title })}
                      className="group/img relative rounded-lg overflow-hidden border border-white/10 bg-black/60 cursor-pointer max-h-80 flex items-center justify-center"
                    >
                      <img
                        src={previewImg}
                        alt={`Preview of ${deliv.title}`}
                        className="w-full object-contain max-h-80 rounded-lg transition-transform duration-300 group-hover/img:scale-[1.01]"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/80 border border-white/20 text-xs text-white font-medium shadow-xl">
                          <Eye className="w-4 h-4 text-[#43D6B0]" />
                          <span>Click to Inspect Image</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Project Details & Technical Repository Section */}
                {(repoUrl || liveProjectUrl || branchName || prUrl) && (
                  <div className="p-3.5 rounded-xl bg-[#176B5B]/10 border border-[#176B5B]/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-[#43D6B0] font-bold tracking-wider flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5" />
                        <span>Project Details & Deployment Links</span>
                      </span>
                      <span className="text-[10px] text-zinc-400">Verified client resources</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {liveProjectUrl && (
                        <a
                          href={liveProjectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/80 border border-white/10 hover:border-[#43D6B0]/50 hover:bg-zinc-900 text-zinc-200 transition-all group"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Globe className="w-4 h-4 text-[#43D6B0] shrink-0" />
                            <div className="truncate">
                              <span className="text-[10px] text-zinc-400 block">Live Project / Preview</span>
                              <span className="font-mono text-xs font-semibold text-white truncate block">
                                {liveProjectUrl.replace(/^https?:\/\//, '')}
                              </span>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#43D6B0] shrink-0 ml-2" />
                        </a>
                      )}

                      {repoUrl && (
                        <a
                          href={repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/80 border border-white/10 hover:border-[#43D6B0]/50 hover:bg-zinc-900 text-zinc-200 transition-all group"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Code2 className="w-4 h-4 text-[#43D6B0] shrink-0" />
                            <div className="truncate">
                              <span className="text-[10px] text-zinc-400 block">Repository</span>
                              <span className="font-mono text-xs font-semibold text-white truncate block">
                                {repoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
                              </span>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#43D6B0] shrink-0 ml-2" />
                        </a>
                      )}

                      {branchName && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900/80 border border-white/10 text-zinc-300">
                          <GitBranch className="w-4 h-4 text-purple-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-zinc-400 block">Active Branch</span>
                            <span className="font-mono text-xs font-medium text-purple-300">{branchName}</span>
                          </div>
                        </div>
                      )}

                      {prUrl && (
                        <a
                          href={prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/80 border border-white/10 hover:border-emerald-400/50 hover:bg-zinc-900 text-zinc-200 transition-all group"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <GitPullRequest className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div className="truncate">
                              <span className="text-[10px] text-zinc-400 block">Pull Request</span>
                              <span className="font-mono text-xs font-semibold text-emerald-300 truncate block">
                                {prUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
                              </span>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-400 shrink-0 ml-2" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Submission Notes */}
                {deliv.submissionMessage && (
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold">Freelancer Notes</span>
                    <p className="text-xs text-zinc-300 italic">{deliv.submissionMessage}</p>
                  </div>
                )}

                {/* Revision Notes if exists */}
                {deliv.revisionNote && (
                  <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">Latest Client Revision Request</span>
                    <p className="text-xs text-amber-200">{deliv.revisionNote}</p>
                  </div>
                )}

                {/* Version History Toggle */}
                <div className="pt-1">
                  <button
                    onClick={() => setExpandedVersionId(isVersionExpanded ? null : deliv.id)}
                    className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white font-mono transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>
                      {isVersionExpanded ? 'Hide Version History' : `View Version History (${(deliv.versionHistory || []).length + 1} versions)`}
                    </span>
                    {isVersionExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isVersionExpanded && (
                    <div className="mt-3 p-4 rounded-xl bg-zinc-900/90 border border-white/10 space-y-3">
                      <h4 className="text-xs font-bold text-white font-mono uppercase">Version Trail</h4>
                      <div className="space-y-2">
                        <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-white">{deliv.version || 'v1.0'} (Current)</span>
                            <span className="text-zinc-400 block text-[10px]">Submitted recently</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => onDownloadClick(deliv)} leftIcon={<Download className="w-3 h-3" />}>
                            Get
                          </Button>
                        </div>
                        {(deliv.versionHistory || []).map((v, idx) => (
                          <div key={v.id || idx} className="p-2.5 rounded-lg bg-zinc-950 border border-white/5 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-zinc-300">{v.versionNumber || v.version}</span>
                              <span className="text-zinc-500 block text-[10px]">{v.note || 'Previous iteration'}</span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">{v.createdDate || v.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Lightbox Modal for inspecting Preview Images in full detail */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center">
            <div className="w-full flex items-center justify-between p-3 bg-zinc-950/80 border-b border-white/10 rounded-t-xl text-white">
              <span className="text-xs font-bold truncate max-w-md">{lightboxImage.title} — Visual Preview</span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-black/95 p-2 rounded-b-xl border border-white/10 border-t-0 flex items-center justify-center overflow-auto max-h-[80vh] w-full">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.title}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
