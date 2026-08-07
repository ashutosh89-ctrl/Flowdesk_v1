import React from 'react';
import { Card } from '../../../components/ui/card';
import { Avatar } from '../../../components/ui/avatar';
import { StatusPill } from '../../../components/ui/status-pill';
import { HealthBadge } from '../../../components/ui/health-badge';
import { Button } from '../../../components/ui/button';
import { Client } from '../../../types';
import {
  ArrowUpRight,
  Building,
  Mail,
  Phone,
  Globe,
  MoreVertical,
  Edit,
  Copy,
  Archive,
  RotateCcw,
  Trash2,
  Clock,
  Briefcase,
  DollarSign,
} from 'lucide-react';

export interface ClientCardProps {
  client: Client;
  onOpenWorkspace: (clientId: string) => void;
  onEdit: (client: Client, e: React.MouseEvent) => void;
  onDuplicate: (client: Client, e: React.MouseEvent) => void;
  onArchive: (client: Client, e: React.MouseEvent) => void;
  onDelete: (client: Client, e: React.MouseEvent) => void;
}

export const ClientCard: React.FC<ClientCardProps> = ({
  client,
  onOpenWorkspace,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);

  return (
    <Card
      variant="crystal"
      onClick={() => onOpenWorkspace(client.id)}
      className="group relative p-6 hover:border-white/30 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-5"
    >
      {/* Card Header: Avatar, Company, Status & Actions Menu */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={client.name} src={client.avatarUrl} size="lg" />
            <div>
              <h3 className="text-base font-bold text-white group-hover:text-white transition-colors flex items-center gap-1.5">
                {client.company}
              </h3>
              <p className="text-xs text-zinc-400 font-normal mt-0.5">{client.industry || 'Freelance Client'}</p>
            </div>
          </div>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowMenu((prev) => !prev)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Quick Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-white/15 rounded-xl shadow-2xl py-1.5 z-30 text-xs space-y-0.5 backdrop-blur-2xl">
                  <button
                    onClick={(e) => {
                      setShowMenu(false);
                      onOpenWorkspace(client.id);
                    }}
                    className="w-full text-left px-3.5 py-2 text-zinc-200 hover:text-white hover:bg-white/10 flex items-center gap-2 font-medium"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" /> Open Workspace
                  </button>
                  <button
                    onClick={(e) => {
                      setShowMenu(false);
                      onEdit(client, e);
                    }}
                    className="w-full text-left px-3.5 py-2 text-zinc-200 hover:text-white hover:bg-white/10 flex items-center gap-2 font-medium"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit Details
                  </button>
                  <button
                    onClick={(e) => {
                      setShowMenu(false);
                      onDuplicate(client, e);
                    }}
                    className="w-full text-left px-3.5 py-2 text-zinc-200 hover:text-white hover:bg-white/10 flex items-center gap-2 font-medium"
                  >
                    <Copy className="w-3.5 h-3.5" /> Duplicate Client
                  </button>
                  <button
                    onClick={(e) => {
                      setShowMenu(false);
                      onArchive(client, e);
                    }}
                    className="w-full text-left px-3.5 py-2 text-zinc-200 hover:text-white hover:bg-white/10 flex items-center gap-2 font-medium"
                  >
                    {client.isArchived || client.status === 'archived' ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" /> Restore Client
                      </>
                    ) : (
                      <>
                        <Archive className="w-3.5 h-3.5" /> Archive Client
                      </>
                    )}
                  </button>
                  <div className="border-t border-white/10 my-1" />
                  <button
                    onClick={(e) => {
                      setShowMenu(false);
                      onDelete(client, e);
                    }}
                    className="w-full text-left px-3.5 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Workspace
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Badges Bar: Health & Status */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <HealthBadge level={client.healthBadge} />
          <StatusPill status={client.status} />
          {client.country && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
              <Globe className="w-3 h-3 text-zinc-500" />
              {client.country}
            </span>
          )}
        </div>

        {/* Contact info list */}
        <div className="space-y-1.5 text-xs text-zinc-400 pt-1">
          <p className="flex items-center gap-2 text-zinc-300">
            <span className="font-semibold text-white">{client.name}</span>
          </p>
          <p className="flex items-center gap-2 text-zinc-400 font-mono text-[11px]">
            <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span className="truncate">{client.email}</span>
          </p>
          {client.phone && (
            <p className="flex items-center gap-2 text-zinc-400 font-mono text-[11px]">
              <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>{client.phone}</span>
            </p>
          )}
        </div>

        {/* Tags */}
        {client.tags && client.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {client.tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-[10px] font-mono bg-zinc-900 text-zinc-300 border border-white/10 px-2 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer Metrics Grid */}
      <div className="pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-center bg-white/[0.01] rounded-xl p-2.5">
        <div>
          <span className="text-[10px] uppercase font-mono text-zinc-500 block">Projects</span>
          <span className="text-sm font-bold text-white font-mono">{client.activeProjectsCount}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-mono text-zinc-500 block">Unpaid</span>
          <span className="text-sm font-bold text-amber-400 font-mono">
            ${(client.outstandingBalance || 0).toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-mono text-zinc-500 block">Lifetime</span>
          <span className="text-sm font-bold text-emerald-400 font-mono">
            ${(client.totalBilled || 0).toLocaleString()}
          </span>
        </div>
      </div>
    </Card>
  );
};
