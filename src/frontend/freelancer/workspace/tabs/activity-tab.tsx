import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/frontend/shared/ui/card';
import { Input } from '@/frontend/shared/ui/input';
import { WorkspaceSummary, ActivityLog } from '@/shared/types';
import {
  Activity,
  Search,
  UserCheck,
  FileEdit,
  Trash2,
  RefreshCw,
  Receipt,
  FileText,
  Archive,
  Filter,
} from 'lucide-react';

export interface ActivityTabProps {
  summary: WorkspaceSummary;
}

export const ActivityTab: React.FC<ActivityTabProps> = ({ summary }) => {
  const { activities, client } = summary;
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = ['all', 'client', 'project', 'deliverable', 'document', 'invoice', 'portal', 'comment'];

  const filteredActivities = activities.filter((act) => {
    const matchesSearch =
      act.action.toLowerCase().includes(search.toLowerCase()) ||
      act.target.toLowerCase().includes(search.toLowerCase()) ||
      act.user.toLowerCase().includes(search.toLowerCase()) ||
      (act.metadata && act.metadata.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || act.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const renderIcon = (action: string, category: string) => {
    if (action.includes('deleted') || action.includes('removed')) return <Trash2 className="w-4 h-4 text-rose-400" />;
    if (action.includes('created') || action.includes('generated')) return <FileEdit className="w-4 h-4 text-emerald-400" />;
    if (action.includes('archived')) return <Archive className="w-4 h-4 text-amber-400" />;
    if (action.includes('invoice') || category === 'invoice') return <Receipt className="w-4 h-4 text-blue-400" />;
    if (action.includes('document') || category === 'document') return <FileText className="w-4 h-4 text-purple-400" />;
    return <RefreshCw className="w-4 h-4 text-zinc-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-white" />
            Workspace Audit Activity Log
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time system audit log tracking all user actions, file modifications, status edits, and portal interactions.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="w-full lg:w-80">
          <Input
            type="search"
            placeholder="Search activity, actions, user, target..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
          />
        </div>

        <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/10 rounded-xl p-1 overflow-x-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize whitespace-nowrap transition-colors ${
                categoryFilter === cat
                  ? 'bg-white text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline List */}
      <Card variant="crystal" className="p-6 border-white/10 space-y-4">
        {filteredActivities.length === 0 ? (
          <div className="py-12 text-center text-zinc-400 text-xs">
            No activity logs match your search and filter criteria.
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-white/10">
            {filteredActivities.map((log) => (
              <div key={log.id} className="relative group">
                {/* Node Icon */}
                <div className="absolute -left-6 top-0.5 p-1 rounded-full bg-zinc-900 border border-white/20 shadow-md">
                  {renderIcon(log.action, log.category)}
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/40 border border-white/5 group-hover:border-white/20 transition-all duration-200 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                    <span className="font-bold text-white">
                      {log.user}{' '}
                      <span className="font-normal text-zinc-400">{log.action}</span>{' '}
                      <strong className="text-zinc-200 font-mono">{log.target}</strong>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                      {log.timestamp}
                    </span>
                  </div>

                  {log.metadata && (
                    <p className="text-[11px] font-mono text-zinc-400 bg-zinc-950/60 p-2 rounded-lg border border-white/5">
                      {log.metadata}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1 text-[10px] font-mono text-zinc-500">
                    <span className="uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                      {log.category}
                    </span>
                    <span>ID: {log.id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
