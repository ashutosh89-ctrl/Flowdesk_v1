import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { WorkspaceSummary } from '@/shared/types';
import { CheckCircle2, Circle, Clock, FileText, DollarSign, MessageSquare, Activity, FolderKanban } from 'lucide-react';

export interface TimelineTabProps {
  summary: WorkspaceSummary;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({ summary }) => {
  const [filter, setFilter] = useState<string>('all');
  const { activities = [], client, projects = [], deliverables = [], invoices = [], documents = [] } = summary;

  // Build unified, real chronological timeline items from the client's actual workspace data
  const timelineItems = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      rawDate: number;
      title: string;
      desc?: string;
      category: 'milestone' | 'deliverable' | 'invoice' | 'document' | 'activity';
      status?: 'completed' | 'in_progress' | 'upcoming' | 'pending';
      user?: string;
    }> = [];

    // 1. Real activities
    activities.forEach((act) => {
      const rawDate = act.timestamp ? new Date(act.timestamp).getTime() : 0;
      let cat: 'milestone' | 'deliverable' | 'invoice' | 'document' | 'activity' = 'activity';
      if (act.category === 'invoice' || act.action.includes('invoice') || act.action.includes('payment')) cat = 'invoice';
      else if (act.category === 'deliverable' || act.action.includes('deliverable')) cat = 'deliverable';
      else if (act.category === 'document' || act.action.includes('document')) cat = 'document';
      else if (act.category === 'project' || act.action.includes('project') || act.action.includes('milestone')) cat = 'milestone';

      items.push({
        id: `act-${act.id}`,
        date: act.timestamp || 'Recent',
        rawDate,
        title: act.target || act.action,
        desc: act.metadata || act.action,
        category: cat,
        status: act.action.includes('paid') || act.action.includes('approved') || act.action.includes('completed') ? 'completed' : 'in_progress',
        user: act.user,
      });
    });

    // 2. Real project milestones
    projects.forEach((proj) => {
      (proj.milestones || []).forEach((m, idx) => {
        const rawDate = m.dueDate ? new Date(m.dueDate).getTime() : 0;
        items.push({
          id: `m-${proj.id}-${idx}`,
          date: m.dueDate ? new Date(m.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date',
          rawDate,
          title: `${proj.title}: ${m.title}`,
          desc: m.desc || `Milestone for project "${proj.title}"`,
          category: 'milestone',
          status: m.completed ? 'completed' : 'upcoming',
        });
      });
    });

    // 3. Real deliverables
    deliverables.forEach((del) => {
      const dateStr = del.dueDate || del.createdAt;
      const rawDate = dateStr ? new Date(dateStr).getTime() : 0;
      items.push({
        id: `del-${del.id}`,
        date: dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
        rawDate,
        title: del.title,
        desc: del.description || `Status: ${del.status}`,
        category: 'deliverable',
        status: del.status === 'approved' || del.status === 'completed' ? 'completed' : del.status === 'preparing' ? 'in_progress' : 'pending',
      });
    });

    // 4. Real invoices
    invoices.forEach((inv) => {
      const dateStr = inv.dueDate || inv.issueDate || inv.createdAt;
      const rawDate = dateStr ? new Date(dateStr).getTime() : 0;
      items.push({
        id: `inv-${inv.id}`,
        date: dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
        rawDate,
        title: `Invoice ${inv.invoiceNumber} (${inv.currency} ${Number(inv.total || 0).toLocaleString()})`,
        desc: `Status: ${(inv.status || inv.paymentStatus || 'draft').toUpperCase()} • Paid: ${inv.currency} ${Number(inv.paidAmount || 0).toLocaleString()}`,
        category: 'invoice',
        status: inv.status === 'paid' ? 'completed' : 'in_progress',
      });
    });

    // 5. Real documents
    documents.forEach((doc) => {
      const dateStr = doc.uploadedAt || doc.updatedAt;
      const rawDate = dateStr ? new Date(dateStr).getTime() : 0;
      items.push({
        id: `doc-${doc.id}`,
        date: dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
        rawDate,
        title: doc.title,
        desc: `${doc.type?.toUpperCase() || 'FILE'} • ${doc.fileName || doc.category || 'Document'}`,
        category: 'document',
        status: doc.status === 'verified' || doc.status === 'uploaded' ? 'completed' : 'pending',
      });
    });

    // Sort descending (latest event first)
    return items.sort((a, b) => b.rawDate - a.rawDate);
  }, [activities, projects, deliverables, invoices, documents]);

  // Filter items by selected tab
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return timelineItems;
    return timelineItems.filter((item) => item.category === filter);
  }, [timelineItems, filter]);

  const getIcon = (cat: string) => {
    switch (cat) {
      case 'deliverable': return <CheckCircle2 className="w-3.5 h-3.5 text-white" />;
      case 'document': return <FileText className="w-3.5 h-3.5 text-white" />;
      case 'invoice': return <DollarSign className="w-3.5 h-3.5 text-white" />;
      case 'milestone': return <FolderKanban className="w-3.5 h-3.5 text-white" />;
      default: return <Activity className="w-3.5 h-3.5 text-white" />;
    }
  };

  return (
    <Card variant="crystal">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>{client.company || client.name} Timeline & Event Feed</CardTitle>
            <CardDescription>Chronological event log and upcoming project milestones</CardDescription>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-zinc-900/60 border border-white/10 rounded-xl">
            {['all', 'milestone', 'deliverable', 'invoice', 'document'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${
                  filter === cat ? 'bg-white text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
            <Clock className="w-10 h-10 mb-3 text-zinc-600" />
            <h4 className="text-sm font-semibold text-zinc-300">No timeline events found</h4>
            <p className="text-xs text-zinc-500 max-w-sm mt-1">
              {filter === 'all'
                ? `No activities, milestones, deliverables, or invoices have been recorded yet for ${client.company || client.name}.`
                : `No ${filter} events recorded yet for this client.`}
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
            {filteredEvents.map((item) => (
              <div key={item.id} className="relative flex items-start gap-4 group">
                <div
                  className={`absolute -left-6 top-1 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    item.status === 'completed'
                      ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                      : item.status === 'in_progress'
                      ? 'bg-zinc-800 text-white border-white/40'
                      : 'bg-zinc-900 text-zinc-600 border-zinc-700'
                  }`}
                >
                  {item.status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-zinc-950" />
                  ) : item.status === 'in_progress' ? (
                    <Circle className="w-2 h-2 fill-current" />
                  ) : (
                    getIcon(item.category)
                  )}
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 w-full group-hover:border-white/20 transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {item.user && (
                        <span className="text-xs font-bold text-white">{item.user}</span>
                      )}
                      <h4 className="text-sm font-bold text-white">{item.title}</h4>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">{item.date}</span>
                  </div>
                  {item.desc && (
                    <p className="text-xs text-zinc-400 mt-1">
                      {item.desc}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
