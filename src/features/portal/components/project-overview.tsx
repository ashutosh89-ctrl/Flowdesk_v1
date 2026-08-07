'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { StatusPill } from '../../../components/ui/status-pill';
import { Project, PortalActivity } from '../../../types';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  Calendar,
  DollarSign,
  Lock,
  Layers,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface ProjectOverviewProps {
  projects: Project[];
  activities: PortalActivity[];
}

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({ projects, activities }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  if (!activeProject) {
    return (
      <Card variant="crystal" className="p-12 text-center space-y-3">
        <FolderKanban className="w-10 h-10 text-zinc-600 mx-auto" />
        <h3 className="text-base font-bold text-white">No Active Projects Found</h3>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
          You currently have no assigned projects in this workspace.
        </p>
      </Card>
    );
  }

  // Filter project-specific timeline activities
  const projectActivities = activities.filter(
    (a) => a.projectId === activeProject.id || a.title.includes(activeProject.title)
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Project Switcher Tabs */}
      {projects.length > 1 && (
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProjectId(p.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-2 ${
                p.id === activeProject.id
                  ? 'bg-white text-zinc-950 font-bold shadow-md shadow-white/10'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>{p.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Project Card */}
      <Card variant="crystal" className="p-6 sm:p-8 space-y-6 border-white/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-zinc-400 font-semibold">PROJECT SUMMARY</span>
              <StatusPill status={activeProject.status} />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">{activeProject.title}</h2>
            <p className="text-xs text-zinc-300 max-w-2xl">{activeProject.description}</p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 shrink-0">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Client View (Read-Only)</span>
          </div>
        </div>

        {/* Project Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Overall Completion</span>
            </div>
            <p className="text-2xl font-extrabold text-white font-mono">{activeProject.completionPercentage}%</p>
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-400 h-1.5 rounded-full"
                style={{ width: `${activeProject.completionPercentage}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Target Launch Date</span>
            </div>
            <p className="text-lg font-bold text-white font-mono">{activeProject.dueDate}</p>
            <p className="text-[11px] text-zinc-500">Started: {activeProject.startDate}</p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1">
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
              <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
              <span>Agreed Budget</span>
            </div>
            <p className="text-2xl font-extrabold text-white font-mono">
              ${activeProject.budget?.toLocaleString()}
            </p>
            <p className="text-[11px] text-zinc-500">Fixed Milestone Agreement</p>
          </div>
        </div>

        {/* Project Milestones */}
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            Project Milestones & Deliverables Roadmap
          </h3>

          <div className="space-y-3">
            {(activeProject.milestones || []).length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs text-zinc-500">
                Milestones currently being structured by the lead designer.
              </div>
            ) : (
              activeProject.milestones?.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-white/20 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-xl border shrink-0 mt-0.5 ${
                        m.completed
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-white/5 border-white/10 text-zinc-500'
                      }`}
                    >
                      {m.completed ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{m.title}</h4>
                      {m.desc && <p className="text-xs text-zinc-400 mt-0.5">{m.desc}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-zinc-500">
                        <span>Due: {m.dueDate}</span>
                      </div>
                    </div>
                  </div>

                  <StatusPill status={m.completed ? 'completed' : 'in_progress'} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Project Timeline */}
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Client Timeline History
          </h3>

          <div className="space-y-3 border-l-2 border-white/10 pl-4 ml-2">
            {projectActivities.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No timeline entries available for this project yet.</p>
            ) : (
              projectActivities.map((act) => (
                <div key={act.id} className="relative space-y-1">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-white border border-zinc-950" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{act.title}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{act.timestamp}</span>
                  </div>
                  <p className="text-xs text-zinc-400">{act.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
