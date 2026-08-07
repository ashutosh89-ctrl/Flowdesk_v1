import React from 'react';
import { Card } from '../../../components/ui/card';
import { Project, Deliverable } from '../../../types';
import { Calendar, Clock, AlertCircle } from 'lucide-react';

export interface DeadlineCardProps {
  projects: Project[];
  deliverables: Deliverable[];
}

export const DeadlineCard: React.FC<DeadlineCardProps> = ({ projects, deliverables }) => {
  const upcomingDeadlines = [
    ...projects.map((p) => ({ title: p.title, date: p.dueDate, type: 'Project' })),
    ...deliverables.map((d) => ({ title: d.title, date: d.dueDate, type: 'Deliverable' })),
  ]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 4);

  return (
    <Card variant="crystal" className="p-5 border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono uppercase text-zinc-400 font-semibold flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-amber-400" />
          Upcoming Target Deadlines
        </h3>
      </div>

      <div className="space-y-2">
        {upcomingDeadlines.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">No active deadlines.</p>
        ) : (
          upcomingDeadlines.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs"
            >
              <div className="truncate">
                <p className="font-semibold text-white truncate">{item.title}</p>
                <p className="text-[10px] text-zinc-500 font-mono">{item.type}</p>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {item.date}
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
