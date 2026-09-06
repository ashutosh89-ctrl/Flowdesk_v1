import React from 'react';
import { Deliverable, Client, Project } from '@/shared/types';
import { StatusBadge } from './status-badge';
import { ApprovalBadge } from './approval-badge';
import {
  Layers,
  Calendar,
  FileText,
  MessageSquare,
  MoreVertical,
  ArrowUpRight,
  Copy,
  Archive,
  Trash2,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Dropdown } from '@/frontend/shared/ui/dropdown';

interface DeliverableCardProps {
  deliverable: Deliverable;
  clients: Client[];
  projects: Project[];
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onOpenWorkspace: (deliverable: Deliverable) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onSubmitForReview?: (id: string) => void;
  onApprove?: (id: string) => void;
  onRequestRevision?: (id: string) => void;
}

export const DeliverableCard: React.FC<DeliverableCardProps> = ({
  deliverable: del,
  clients,
  projects,
  isSelected,
  onToggleSelect,
  onOpenWorkspace,
  onDuplicate,
  onArchive,
  onDelete,
  onSubmitForReview,
  onApprove,
  onRequestRevision,
}) => {
  const clientName =
    clients.find((c) => c.id === del.clientId)?.company ||
    clients.find((c) => c.id === del.clientId)?.name ||
    'Unassigned';
  const projectName = projects.find((p) => p.id === del.projectId)?.title || 'General Project';
  const filesCount = del.filesCount || (del.files ? del.files.length : del.fileUrl ? 1 : 0);
  const commentsCount = del.commentsCount || (del.comments ? del.comments.length : 0);

  return (
    <div
      onClick={() => onOpenWorkspace(del)}
      className={`group relative rounded-2xl border bg-zinc-950/70 p-5 transition-all duration-300 backdrop-blur-xl flex flex-col justify-between cursor-pointer hover:border-white/20 hover:shadow-2xl ${
        isSelected
          ? 'border-white/40 bg-white/[0.04] shadow-[0_0_20px_rgba(255,255,255,0.05)]'
          : 'border-white/10'
      }`}
    >
      <div>
        {/* Top bar: Selection checkbox, Version tag, Action Menu */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(del.id)}
              className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer"
            />
            <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[11px] font-mono text-zinc-300 font-semibold">
              {del.version}
            </span>
          </div>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Dropdown
              trigger={
                <button className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              }
              items={[
                {
                  id: 'open-workspace',
                  label: 'Open Workspace',
                  icon: <ArrowUpRight className="w-4 h-4" />,
                  onClick: () => onOpenWorkspace(del),
                },
                {
                  id: 'submit-review',
                  label: 'Submit for Review',
                  icon: <Send className="w-4 h-4 text-purple-400" />,
                  onClick: () => onSubmitForReview && onSubmitForReview(del.id),
                  hidden: del.status === 'submitted' || del.status === 'approved',
                },
                {
                  id: 'client-approve',
                  label: 'Client Approve',
                  icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
                  onClick: () => onApprove && onApprove(del.id),
                },
                {
                  id: 'request-revision',
                  label: 'Request Revision',
                  icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
                  onClick: () => onRequestRevision && onRequestRevision(del.id),
                },
                {
                  id: 'duplicate',
                  label: 'Duplicate',
                  icon: <Copy className="w-4 h-4 text-blue-400" />,
                  onClick: () => onDuplicate(del.id),
                },
                {
                  id: 'archive',
                  label: del.isArchived ? 'Restore' : 'Archive',
                  icon: <Archive className="w-4 h-4 text-zinc-400" />,
                  onClick: () => onArchive(del.id),
                },
                {
                  id: 'delete',
                  label: 'Delete Deliverable',
                  icon: <Trash2 className="w-4 h-4 text-rose-400" />,
                  onClick: () => onDelete(del.id),
                  danger: true,
                },
              ].filter((item) => !item.hidden)}
            />
          </div>
        </div>

        {/* Deliverable Icon & Title */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0 group-hover:scale-105 group-hover:border-white/20 transition-all shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-white tracking-tight group-hover:text-emerald-400 transition-colors line-clamp-1">
              {del.title}
            </h3>
            <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
              {del.description}
            </p>
          </div>
        </div>

        {/* Client & Project */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 mb-4">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Client</span>
            <span className="font-semibold text-zinc-200">{clientName}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Project</span>
            <span className="font-medium text-zinc-400 truncate max-w-[150px]">{projectName}</span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <StatusBadge status={del.status} size="sm" />
          <ApprovalBadge status={del.approvalStatus} size="sm" />
        </div>
      </div>

      {/* Footer Meta */}
      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
        <div className="flex items-center gap-1.5" title="Due Date">
          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
          <span>{del.dueDate}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1" title={`${filesCount} files`}>
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <span>{filesCount}</span>
          </span>
          <span className="flex items-center gap-1" title={`${commentsCount} comments`}>
            <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
            <span>{commentsCount}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
