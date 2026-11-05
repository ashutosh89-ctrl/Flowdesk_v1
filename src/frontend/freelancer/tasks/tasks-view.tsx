'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Modal } from '@/frontend/shared/ui/modal';
import { Task, TaskStatus, TaskPriority, Project } from '@/shared/types';
import { TaskService, ProjectService } from '@/backend/freelancer';
import { useToast } from '@/frontend/shared/ui/toast';
import {
  CheckSquare,
  Plus,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Clock,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Calendar,
  FolderKanban,
  Loader2,
} from 'lucide-react';

export const TasksView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskProject, setNewTaskProject] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [tasksData, projectsData] = await Promise.all([
        TaskService.getTasks(),
        ProjectService.getProjects(),
      ]);
      setTasks(tasksData || []);
      setProjects(projectsData || []);
    } catch {
      showToast('Error', 'Failed to load tasks.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      setSubmitting(true);
      const created = await TaskService.createTask({
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim(),
        projectId: newTaskProject || null,
        priority: newTaskPriority,
        status: 'todo',
        dueDate: newTaskDueDate || null,
      });

      setTasks((prev) => [created, ...prev]);
      showToast('Task Created', `"${created.title}" added to your workspace.`, 'success');
      setIsAddModalOpen(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskProject('');
      setNewTaskDueDate('');
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to create task.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const updated = await TaskService.updateTask(taskId, { status: newStatus });
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
      }
    } catch {
      showToast('Error', 'Failed to update task status.', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const ok = await TaskService.deleteTask(taskId);
      if (ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        showToast('Task Removed', 'Task deleted successfully.', 'info');
      }
    } catch {
      showToast('Error', 'Failed to delete task.', 'error');
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterProject !== 'all' && t.projectId !== filterProject) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'urgent':
        return <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">Urgent</span>;
      case 'high':
        return <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">High</span>;
      case 'medium':
        return <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">Medium</span>;
      default:
        return <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-500/20 text-zinc-400 border border-zinc-500/30">Low</span>;
    }
  };

  const columns: { status: TaskStatus; label: string; icon: React.ReactNode; color: string }[] = [
    { status: 'todo', label: 'To Do', icon: <Clock className="w-4 h-4 text-sky-400" />, color: 'border-sky-500/30' },
    { status: 'in_progress', label: 'In Progress', icon: <AlertCircle className="w-4 h-4 text-amber-400" />, color: 'border-amber-500/30' },
    { status: 'blocked', label: 'Blocked', icon: <AlertCircle className="w-4 h-4 text-rose-400" />, color: 'border-rose-500/30' },
    { status: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, color: 'border-emerald-500/30' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-3 text-[#A6B4AE]">
        <Loader2 className="w-8 h-8 animate-spin text-[#43D6B0]" />
        <p className="text-sm">Loading workspace tasks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#F5F5F0] tracking-tight flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-[#43D6B0]" />
            Task Management
          </h2>
          <p className="text-sm text-[#A6B4AE]">
            Track actionable milestones, internal to-dos, and client deliverable assignments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center p-1 bg-[#141816] border border-[#176B5B]/30 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'kanban' ? 'bg-[#176B5B]/40 text-[#43D6B0]' : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
              }`}
              title="Kanban Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-[#176B5B]/40 text-[#43D6B0]' : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
              }`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Task
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-[#141816] border border-[#176B5B]/20 rounded-2xl text-xs">
        <div className="flex items-center gap-2 text-[#A6B4AE]">
          <Filter className="w-3.5 h-3.5 text-[#43D6B0]" />
          <span>Filter:</span>
        </div>

        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="bg-[#191F1D] border border-[#176B5B]/30 rounded-lg px-2.5 py-1 text-[#F5F5F0] focus:outline-none focus:border-[#43D6B0]"
        >
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="bg-[#191F1D] border border-[#176B5B]/30 rounded-lg px-2.5 py-1 text-[#F5F5F0] focus:outline-none focus:border-[#43D6B0]"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <span className="ml-auto font-mono text-[#A6B4AE] text-[11px]">
          {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {columns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.status);

            return (
              <div
                key={col.status}
                className="bg-[#141816]/70 border border-[#176B5B]/25 rounded-2xl p-4 flex flex-col min-h-[400px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#176B5B]/20">
                  <div className="flex items-center gap-2">
                    {col.icon}
                    <span className="text-sm font-bold text-[#F5F5F0]">{col.label}</span>
                  </div>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-white/5 text-[#A6B4AE]">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Tasks */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                  {colTasks.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#A6B4AE]/60 border border-dashed border-[#176B5B]/20 rounded-xl">
                      No tasks in this stage
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-3.5 rounded-xl bg-[#191F1D] border border-[#176B5B]/30 hover:border-[#43D6B0]/50 transition-all space-y-2.5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-semibold text-[#F5F5F0] leading-snug">
                            {task.title}
                          </h4>
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-[#A6B4AE] hover:text-rose-400 p-1"
                            title="Delete task"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {task.description && (
                          <p className="text-[11px] text-[#A6B4AE] line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#176B5B]/20 text-[10px]">
                          {getPriorityBadge(task.priority)}

                          {task.dueDate && (
                            <span className="flex items-center gap-1 font-mono text-[#A6B4AE]">
                              <Calendar className="w-3 h-3" />
                              {task.dueDate}
                            </span>
                          )}
                        </div>

                        {/* Move status dropdown */}
                        <div className="pt-1">
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                            className="w-full bg-[#101312] border border-[#176B5B]/30 rounded-lg px-2 py-1 text-[11px] text-[#A6B4AE] focus:text-[#F5F5F0]"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Card variant="crystal">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141816] text-[#A6B4AE] uppercase tracking-wider font-mono border-b border-[#176B5B]/25">
                  <tr>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Task</th>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#176B5B]/20 text-[#F5F5F0]">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#A6B4AE]">
                        No tasks match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => (
                      <tr key={task.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                            className="bg-[#191F1D] border border-[#176B5B]/30 rounded-lg px-2 py-1 text-xs text-[#F5F5F0]"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="blocked">Blocked</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold">{task.title}</p>
                          {task.description && (
                            <p className="text-[#A6B4AE] text-[11px] truncate max-w-sm">
                              {task.description}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#A6B4AE]">
                          {projects.find((p) => p.id === task.projectId)?.title || '—'}
                        </td>
                        <td className="py-3 px-4">{getPriorityBadge(task.priority)}</td>
                        <td className="py-3 px-4 font-mono text-[#A6B4AE]">
                          {task.dueDate || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 text-[#A6B4AE] hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Task Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New Task"
        description="Add an actionable operational task to your workspace."
      >
        <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-[#A6B4AE] mb-1.5">Task Title *</label>
            <input
              type="text"
              required
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="e.g., Deliver interactive prototype v2"
              className="w-full bg-[#101312] border border-[#176B5B]/40 rounded-xl px-3 py-2 text-sm text-[#F5F5F0] focus:outline-none focus:border-[#43D6B0]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#A6B4AE] mb-1.5">Description</label>
            <textarea
              rows={3}
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              placeholder="Provide helpful context, steps, or notes..."
              className="w-full bg-[#101312] border border-[#176B5B]/40 rounded-xl px-3 py-2 text-sm text-[#F5F5F0] focus:outline-none focus:border-[#43D6B0]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#A6B4AE] mb-1.5">Associated Project</label>
              <select
                value={newTaskProject}
                onChange={(e) => setNewTaskProject(e.target.value)}
                className="w-full bg-[#101312] border border-[#176B5B]/40 rounded-xl px-3 py-2 text-sm text-[#F5F5F0] focus:outline-none focus:border-[#43D6B0]"
              >
                <option value="">No Project (General)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A6B4AE] mb-1.5">Priority</label>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                className="w-full bg-[#101312] border border-[#176B5B]/40 rounded-xl px-3 py-2 text-sm text-[#F5F5F0] focus:outline-none focus:border-[#43D6B0]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#A6B4AE] mb-1.5">Due Date</label>
            <input
              type="date"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              className="w-full bg-[#101312] border border-[#176B5B]/40 rounded-xl px-3 py-2 text-sm text-[#F5F5F0] focus:outline-none focus:border-[#43D6B0]"
            />
          </div>

          <div className="pt-3 border-t border-[#176B5B]/20 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

