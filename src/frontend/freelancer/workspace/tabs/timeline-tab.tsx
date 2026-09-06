import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { WorkspaceSummary } from '@/shared/types';
import { CheckCircle2, Circle, Clock, FileText, DollarSign, MessageSquare, Users, Activity } from 'lucide-react';

export interface TimelineTabProps {
  summary: WorkspaceSummary;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({ summary }) => {
  const [filter, setFilter] = useState<string>('all');
  const { activities, client } = summary;

  const defaultTimelineEvents = [
    { date: 'Jul 10, 2026', title: 'Core UI Kit & Token Spec Delivered', category: 'deliverable', status: 'completed', desc: 'Figma tokens, glass buttons, and typography scales.' },
    { date: 'Jul 28, 2026', title: 'Command Palette Integration', category: 'project', status: 'completed', desc: 'Fuzzy search component for desktop dashboard.' },
    { date: 'Aug 01, 2026', title: 'Invoice INV-2026-001 Settlement ($15,000.00)', category: 'invoice', status: 'completed', desc: 'Direct wire payment confirmed.' },
    { date: 'Aug 08, 2026', title: 'Analytics Dashboard Milestone 2', category: 'project', status: 'in_progress', desc: 'Executive reporting suite with real-time streaming widgets.' },
    { date: 'Aug 25, 2026', title: 'Final System Sign-off & Handover', category: 'milestone', status: 'upcoming', desc: 'Production bundle build & documentation package.' },
  ];

  const getIcon = (cat: string) => {
    switch (cat) {
      case 'deliverable': return <CheckCircle2 className="w-3.5 h-3.5 text-white" />;
      case 'document': return <FileText className="w-3.5 h-3.5 text-white" />;
      case 'invoice': return <DollarSign className="w-3.5 h-3.5 text-white" />;
      case 'comment': return <MessageSquare className="w-3.5 h-3.5 text-white" />;
      default: return <Activity className="w-3.5 h-3.5 text-white" />;
    }
  };

  return (
    <Card variant="crystal">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>{client.company} Timeline & Event Feed</CardTitle>
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
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
          {/* Combine activity logs and static milestones */}
          {activities.map((act) => (
            <div key={act.id} className="relative flex items-start gap-4 group">
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-zinc-900 border border-white/20 flex items-center justify-center shrink-0">
                {getIcon(act.category)}
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 w-full hover:border-white/20 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{act.user}</span>
                    <span className="text-xs text-zinc-400">{act.action}</span>
                    <span className="text-xs font-bold text-white font-mono">{act.target}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">{act.timestamp}</span>
                </div>
                {act.metadata && (
                  <p className="text-xs text-zinc-400 mt-1 pl-2 border-l-2 border-white/10 italic">
                    {act.metadata}
                  </p>
                )}
              </div>
            </div>
          ))}

          {defaultTimelineEvents.map((item, idx) => (
            <div key={`static-${idx}`} className="relative flex items-start gap-4 group">
              <div
                className={`absolute -left-6 top-1 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  item.status === 'completed'
                    ? 'bg-white text-zinc-950 border-white'
                    : item.status === 'in_progress'
                    ? 'bg-zinc-800 text-white border-white/40'
                    : 'bg-zinc-900 text-zinc-600 border-zinc-700'
                }`}
              >
                {item.status === 'completed' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-950" />
                ) : (
                  <Circle className="w-2 h-2 fill-current" />
                )}
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 w-full group-hover:border-white/20 transition-all">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">{item.title}</h4>
                  <span className="text-[10px] font-mono text-zinc-400">{item.date}</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
