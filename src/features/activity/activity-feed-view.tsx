import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { ActivityService } from '../../services';
import { ActivityLog } from '../../types';
import { Activity, Clock, CheckCircle2, FileText, Users, DollarSign } from 'lucide-react';

export const ActivityFeedView: React.FC = () => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    ActivityService.getActivities().then(setActivities);
  }, []);

  const filteredActivities = activities.filter(
    (a) => filter === 'all' || a.category === filter
  );

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'client':
        return <Users className="w-4 h-4 text-white" />;
      case 'project':
        return <Activity className="w-4 h-4 text-white" />;
      case 'invoice':
        return <DollarSign className="w-4 h-4 text-white" />;
      case 'deliverable':
        return <CheckCircle2 className="w-4 h-4 text-white" />;
      default:
        return <FileText className="w-4 h-4 text-white" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="pb-6 border-b border-white/10">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Audit & Activity Trail</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Real-time chronological feed of client interactions, payments, and approvals.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-zinc-900/60 border border-white/10 rounded-xl max-w-md">
        {['all', 'client', 'project', 'invoice', 'deliverable'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
              filter === cat ? 'bg-white text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Activity Timeline */}
      <Card variant="crystal">
        <CardContent className="pt-6">
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
            {filteredActivities.map((act) => (
              <div key={act.id} className="relative flex items-start gap-4 group">
                <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-zinc-900 border border-white/20 flex items-center justify-center shrink-0">
                  {getCategoryIcon(act.category)}
                </div>

                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 w-full hover:border-white/20 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{act.user}</span>
                      <span className="text-xs text-zinc-400">{act.action}</span>
                      <span className="text-xs font-bold text-white font-mono">{act.target}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {act.timestamp}
                    </span>
                  </div>
                  {act.metadata && (
                    <p className="text-xs text-zinc-400 mt-1 pl-2 border-l-2 border-white/10 italic">
                      {act.metadata}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
