'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
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
  MessageSquare,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

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
          <p className="text-xs text-zinc-400">Review assets, inspect version history, and approve milestones</p>
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
                    <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-400 pt-1">
                      <span>Review Deadline: {deliv.dueDate}</span>
                      {deliv.fileSize && <span>Size: {deliv.fileSize}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {deliv.fileUrl && deliv.fileUrl !== '#' && deliv.fileUrl !== '' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDownloadClick(deliv)}
                        leftIcon={<Download className="w-3.5 h-3.5" />}
                      >
                        Download
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="opacity-50 cursor-not-allowed"
                        leftIcon={<Download className="w-3.5 h-3.5 text-zinc-500" />}
                      >
                        File Unavailable
                      </Button>
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
    </div>
  );
};
