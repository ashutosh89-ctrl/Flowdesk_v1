'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { PortalActivity } from '../../../types';
import {
  Clock,
  CheckSquare,
  FileText,
  CreditCard,
  RotateCcw,
  Upload,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface ActivityPanelProps {
  activities: PortalActivity[];
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({ activities }) => {
  // Category Icon helper
  const getCategoryIcon = (category: PortalActivity['category']) => {
    switch (category) {
      case 'deliverable':
        return <CheckSquare className="w-4 h-4 text-amber-400" />;
      case 'approval':
        return <CheckSquare className="w-4 h-4 text-emerald-400" />;
      case 'revision':
        return <RotateCcw className="w-4 h-4 text-amber-400" />;
      case 'invoice':
        return <CreditCard className="w-4 h-4 text-indigo-400" />;
      case 'document':
      case 'file_request':
        return <FileText className="w-4 h-4 text-blue-400" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-indigo-300" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="pb-2 border-b border-white/10">
        <h2 className="text-lg font-bold text-white tracking-tight">Client Activity Log</h2>
        <p className="text-xs text-zinc-400">Chronological history of workspace milestones and client updates</p>
      </div>

      <Card variant="crystal" className="p-6 border-white/15">
        <div className="space-y-6">
          {activities.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              <Clock className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
              No activity logged yet.
            </div>
          ) : (
            activities.map((act, index) => (
              <div key={act.id || index} className="flex items-start gap-4 group">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0 mt-0.5 group-hover:border-white/25 transition-all">
                  {getCategoryIcon(act.category)}
                </div>

                <div className="flex-1 min-w-0 pb-4 border-b border-white/5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-white">{act.title}</h4>
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">{act.timestamp}</span>
                  </div>
                  <p className="text-xs text-zinc-300">{act.description}</p>
                  <span className="text-[10px] font-mono text-zinc-500 block">Actor: {act.actor}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
