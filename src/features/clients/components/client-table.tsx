import React from 'react';
import { Card } from '../../../components/ui/card';
import { Avatar } from '../../../components/ui/avatar';
import { StatusPill } from '../../../components/ui/status-pill';
import { HealthBadge } from '../../../components/ui/health-badge';
import { Button } from '../../../components/ui/button';
import { Client } from '../../../types';
import {
  ArrowUpRight,
  Mail,
  Phone,
  Edit,
  Copy,
  Archive,
  RotateCcw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';

export interface ClientTableProps {
  clients: Client[];
  totalClientsCount: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onOpenWorkspace: (clientId: string) => void;
  onEdit: (client: Client, e: React.MouseEvent) => void;
  onDuplicate: (client: Client, e: React.MouseEvent) => void;
  onArchive: (client: Client, e: React.MouseEvent) => void;
  onDelete: (client: Client, e: React.MouseEvent) => void;
}

export const ClientTable: React.FC<ClientTableProps> = ({
  clients,
  totalClientsCount,
  currentPage,
  totalPages,
  onPageChange,
  onOpenWorkspace,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
}) => {
  return (
    <Card variant="crystal" className="p-0 overflow-hidden border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02] text-zinc-400 font-mono uppercase text-[10px]">
              <th className="py-4 px-6 font-semibold">Client / Company</th>
              <th className="py-4 px-6 font-semibold">Contact & Location</th>
              <th className="py-4 px-6 font-semibold">Active Projects</th>
              <th className="py-4 px-6 font-semibold">Outstanding</th>
              <th className="py-4 px-6 font-semibold">Lifetime Revenue</th>
              <th className="py-4 px-6 font-semibold">Health Score</th>
              <th className="py-4 px-6 font-semibold">Status</th>
              <th className="py-4 px-6 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-zinc-400">
                  No clients found matching your search and filter criteria.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => onOpenWorkspace(client.id)}
                  className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                >
                  {/* Company & Avatar */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <Avatar name={client.name} src={client.avatarUrl} size="md" />
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-white flex items-center gap-1.5">
                          {client.company}
                        </h4>
                        <span className="text-zinc-400 text-[11px] font-mono">
                          {client.industry || 'Freelance Client'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Contact & Email */}
                  <td className="py-4 px-6">
                    <p className="font-semibold text-white">{client.name}</p>
                    <p className="text-zinc-400 text-[11px] flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3 text-zinc-500" /> {client.email}
                    </p>
                    {client.country && (
                      <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                        {client.country}
                      </span>
                    )}
                  </td>

                  {/* Active Projects */}
                  <td className="py-4 px-6">
                    <span className="font-bold text-white text-sm font-mono">{client.activeProjectsCount}</span>
                    <span className="text-zinc-400 text-[11px] ml-1">active</span>
                  </td>

                  {/* Outstanding Balance */}
                  <td className="py-4 px-6">
                    <span className="font-bold text-amber-400 text-xs font-mono">
                      ${(client.outstandingBalance || 0).toLocaleString()}
                    </span>
                  </td>

                  {/* Lifetime Revenue */}
                  <td className="py-4 px-6 font-bold text-white text-sm font-mono">
                    ${client.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>

                  {/* Health */}
                  <td className="py-4 px-6">
                    <HealthBadge level={client.healthBadge} />
                  </td>

                  {/* Status */}
                  <td className="py-4 px-6">
                    <StatusPill status={client.status} />
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenWorkspace(client.id)}
                        rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
                      >
                        Workspace
                      </Button>

                      <button
                        onClick={(e) => onEdit(client, e)}
                        title="Edit Details"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => onDuplicate(client, e)}
                        title="Duplicate Client"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        onClick={(e) => onArchive(client, e)}
                        title={client.isArchived || client.status === 'archived' ? 'Restore Client' : 'Archive Client'}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        {client.isArchived || client.status === 'archived' ? (
                          <RotateCcw className="w-4 h-4" />
                        ) : (
                          <Archive className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={(e) => onDelete(client, e)}
                        title="Delete Client Workspace"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination */}
      <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/[0.01]">
        <span className="text-xs text-zinc-400 font-mono">
          SHOWING <strong className="text-white">{clients.length}</strong> OF{' '}
          <strong className="text-white">{totalClientsCount}</strong> CLIENTS
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            leftIcon={<ChevronLeft className="w-4 h-4" />}
          >
            Prev
          </Button>

          <span className="text-xs text-zinc-400 font-mono px-2">
            Page {currentPage} of {totalPages || 1}
          </span>

          <Button
            variant="ghost"
            size="sm"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
};
