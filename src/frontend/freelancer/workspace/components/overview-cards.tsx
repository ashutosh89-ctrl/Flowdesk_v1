import React from 'react';
import { WorkspaceSummary } from '@/shared/types';
import { RevenueCard } from './revenue-card';
import { RecentFiles } from './recent-files';
import { DeadlineCard } from './deadline-card';
import { Card } from '@/frontend/shared/ui/card';
import { FolderKanban, Layers, FileText, CheckCircle2 } from 'lucide-react';

export interface OverviewCardsProps {
  summary: WorkspaceSummary;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ summary }) => {
  const { client, projects, deliverables, documents, invoices } = summary;

  const outstandingBalance = invoices
    .filter((inv) => inv.status === 'pending' || inv.status === 'overdue')
    .reduce((acc, inv) => acc + inv.total, 0);

  return (
    <div className="space-y-6">
      {/* Top 4 Key Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="crystal" className="p-4 border-white/10">
          <span className="text-[10px] uppercase font-mono text-zinc-400 block">Active Projects</span>
          <span className="text-xl font-bold text-white font-mono mt-1 block">{projects.length}</span>
        </Card>
        <Card variant="crystal" className="p-4 border-white/10">
          <span className="text-[10px] uppercase font-mono text-zinc-400 block">Pending Deliverables</span>
          <span className="text-xl font-bold text-white font-mono mt-1 block">
            {deliverables.filter((d) => d.status !== 'approved').length}
          </span>
        </Card>
        <Card variant="crystal" className="p-4 border-white/10">
          <span className="text-[10px] uppercase font-mono text-zinc-400 block">Documents Status</span>
          <span className="text-xl font-bold text-emerald-400 font-mono mt-1 block">
            {documents.filter((doc) => doc.status === 'verified').length}/{documents.length}
          </span>
        </Card>
        <Card variant="crystal" className="p-4 border-white/10">
          <span className="text-[10px] uppercase font-mono text-zinc-400 block">Unpaid Invoices</span>
          <span className="text-xl font-bold text-amber-400 font-mono mt-1 block">
            ${outstandingBalance.toLocaleString()}
          </span>
        </Card>
      </div>

      {/* Grid widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RevenueCard
          totalBilled={client.totalBilled}
          outstandingBalance={outstandingBalance}
          currency={client.currency}
        />
        <RecentFiles documents={documents} deliverables={deliverables} />
        <DeadlineCard projects={projects} deliverables={deliverables} />
      </div>
    </div>
  );
};
