import React from 'react';
import { Deliverable, Client, Project } from '../../../types';
import { StatusBadge } from './status-badge';
import { ApprovalBadge } from './approval-badge';
import { Button } from '../../../components/ui/button';
import {
  FileText,
  MessageSquare,
  MoreVertical,
  Calendar,
  Layers,
  ArrowUpRight,
  Copy,
  Archive,
  Trash2,
  Send,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Dropdown } from '../../../components/ui/dropdown';

interface DeliverablesTableProps {
  deliverables: Deliverable[];
  clients: Client[];
  projects: Project[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onOpenWorkspace: (deliverable: Deliverable) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onSubmitForReview?: (id: string) => void;
  onApprove?: (id: string) => void;
  onRequestRevision?: (id: string) => void;
}

export const DeliverablesTable: React.FC<DeliverablesTableProps> = ({
  deliverables,
  clients,
  projects,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onOpenWorkspace,
  onDuplicate,
  onArchive,
  onDelete,
  onSubmitForReview,
  onApprove,
  onRequestRevision,
}) => {
  const isAllSelected = deliverables.length > 0 && selectedIds.length === deliverables.length;

  const getClientName = (clientId: string) =>
    clients.find((c) => c.id === clientId)?.company || clients.find((c) => c.id === clientId)?.name || 'Unassigned';

  const getProjectName = (projectId: string) =>
    projects.find((p) => p.id === projectId)?.title || 'General Project';

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/60 backdrop-blur-xl shadow-2xl">
      <table className="w-full text-left text-sm text-zinc-300">
        <thead className="border-b border-white/10 bg-white/[0.02] text-xs font-semibold uppercase tracking-wider text-zinc-400 select-none">
          <tr>
            <th className="p-4 w-10">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={onSelectAll}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer"
              />
            </th>
            <th className="p-4">Deliverable & Version</th>
            <th className="p-4">Client & Project</th>
            <th className="p-4">Delivery Status</th>
            <th className="p-4">Approval Status</th>
            <th className="p-4">Due Date</th>
            <th className="p-4 text-center">Files / Comments</th>
            <th className="p-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {deliverables.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-12 text-center text-zinc-500">
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400">
                    <Layers className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium text-zinc-300">No deliverables found</p>
                  <p className="text-xs text-zinc-500">Try adjusting search query or active filter tags.</p>
                </div>
              </td>
            </tr>
          ) : (
            deliverables.map((del) => {
              const isSelected = selectedIds.includes(del.id);
              const clientName = getClientName(del.clientId);
              const projectName = getProjectName(del.projectId);
              const filesCount = del.filesCount || (del.files ? del.files.length : del.fileUrl ? 1 : 0);
              const commentsCount = del.commentsCount || (del.comments ? del.comments.length : 0);

              return (
                <tr
                  key={del.id}
                  className={`group hover:bg-white/[0.03] transition-colors cursor-pointer ${
                    isSelected ? 'bg-white/[0.05]' : ''
                  }`}
                  onClick={() => onOpenWorkspace(del)}
                >
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(del.id)}
                      className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer"
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300 shrink-0 group-hover:border-white/20 group-hover:text-white transition-all">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate hover:underline">
                            {del.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[10px] font-mono text-zinc-300 shrink-0">
                            {del.version}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400 truncate max-w-xs mt-0.5">
                          {del.description}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="flex flex-col text-xs">
                      <span className="font-medium text-zinc-200">{clientName}</span>
                      <span className="text-zinc-500 text-[11px] truncate">{projectName}</span>
                    </div>
                  </td>

                  <td className="p-4">
                    <StatusBadge status={del.status} />
                  </td>

                  <td className="p-4">
                    <ApprovalBadge status={del.approvalStatus} />
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{del.dueDate}</span>
                    </div>
                  </td>

                  <td className="p-4 text-center">
                    <div className="inline-flex items-center gap-3 text-xs text-zinc-400">
                      <span className="flex items-center gap-1" title={`${filesCount} attached files`}>
                        <FileText className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{filesCount}</span>
                      </span>
                      <span className="flex items-center gap-1" title={`${commentsCount} comments`}>
                        <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                        <span>{commentsCount}</span>
                      </span>
                    </div>
                  </td>

                  <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      trigger={
                        <button className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
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
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
