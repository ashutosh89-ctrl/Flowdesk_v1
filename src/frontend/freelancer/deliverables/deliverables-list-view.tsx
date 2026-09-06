import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DeliverableService, ClientService, ProjectService } from '@/backend/freelancer';
import { Deliverable, Client, Project, DeliverableStatus, ApprovalStatus } from '@/shared/types';
import { DeliverablesTable } from './components/deliverables-table';
import { DeliverableCard } from './components/deliverable-card';
import { CreateDeliverableModal } from './components/create-deliverable-modal';
import { DeliverableWorkspaceModal } from './components/deliverable-workspace-modal';
import { ConfirmDialog } from '@/frontend/shared/ui/confirm-dialog';
import { Button } from '@/frontend/shared/ui/button';
import { Input } from '@/frontend/shared/ui/input';
import { Pagination } from '@/frontend/shared/ui/pagination';
import { useToast } from '@/frontend/shared/ui/toast';
import {
  Layers,
  Plus,
  Search,
  Filter,
  LayoutGrid,
  List,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Archive,
  Trash2,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react';

interface DeliverablesListViewProps {
  onOpenClientWorkspace?: (clientId: string) => void;
}

export const DeliverablesListView: React.FC<DeliverablesListViewProps> = ({
  onOpenClientWorkspace,
}) => {
  const { showToast } = useToast();

  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Layout View Mode (Table vs Grid)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedApprovalFilter, setSelectedApprovalFilter] = useState<string>('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('all');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<'dueDate' | 'createdAt' | 'title' | 'status' | 'version'>('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeWorkspaceDeliverableId, setActiveWorkspaceDeliverableId] = useState<string | null>(null);

  // Confirm Delete Dialog
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [delData, clientData, projData] = await Promise.all([
        DeliverableService.getDeliverables(undefined, includeArchived),
        ClientService.getClients(),
        ProjectService.getProjects(),
      ]);
      setDeliverables(delData);
      setClients(clientData);
      setProjects(projData);
    } finally {
      setIsLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Overdue detection helper
  const isOverdue = (del: Deliverable): boolean => {
    if (!del.dueDate) return false;
    if (del.status === 'approved' || del.status === 'completed' || del.status === 'archived') return false;
    return new Date(del.dueDate) < new Date();
  };

  const overdueCount = deliverables.filter(isOverdue).length;

  // Metrics summary computations
  const totalCount = deliverables.length;
  const pendingReviewCount = deliverables.filter(
    (d) => d.approvalStatus === 'pending' || d.status === 'submitted' || d.status === 'ready_for_review'
  ).length;
  const approvedCount = deliverables.filter(
    (d) => d.approvalStatus === 'approved' || d.status === 'approved'
  ).length;
  const revisionRequestedCount = deliverables.filter(
    (d) => d.approvalStatus === 'revision_requested' || d.status === 'revision_requested'
  ).length;

  // Filtering Logic
  const filteredDeliverables = useMemo(() => {
    return deliverables.filter((del) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientName = clients.find((c) => c.id === del.clientId)?.company || clients.find((c) => c.id === del.clientId)?.name || '';
        const projName = projects.find((p) => p.id === del.projectId)?.title || '';
        const matchTitle = del.title.toLowerCase().includes(q);
        const matchDesc = del.description.toLowerCase().includes(q);
        const matchVer = del.version.toLowerCase().includes(q);
        const matchClient = clientName.toLowerCase().includes(q);
        const matchProj = projName.toLowerCase().includes(q);

        if (!matchTitle && !matchDesc && !matchVer && !matchClient && !matchProj) {
          return false;
        }
      }

      // Client Filter
      if (selectedClientFilter !== 'all' && del.clientId !== selectedClientFilter) {
        return false;
      }

      // Project Filter
      if (selectedProjectFilter !== 'all' && del.projectId !== selectedProjectFilter) {
        return false;
      }

      // Delivery Status Filter
      if (selectedStatusFilter !== 'all' && del.status !== selectedStatusFilter) {
        return false;
      }

      // Approval Status Filter
      if (selectedApprovalFilter !== 'all' && del.approvalStatus !== selectedApprovalFilter) {
        return false;
      }

      // Priority Filter
      if (selectedPriorityFilter !== 'all' && del.priority !== selectedPriorityFilter) {
        return false;
      }

      return true;
    });
  }, [
    deliverables,
    searchQuery,
    selectedClientFilter,
    selectedProjectFilter,
    selectedStatusFilter,
    selectedApprovalFilter,
    selectedPriorityFilter,
    clients,
    projects,
  ]);

  // Sorted Deliverables
  const sortedDeliverables = useMemo(() => {
    return [...filteredDeliverables].sort((a, b) => {
      let valA: any = a[sortBy] || '';
      let valB: any = b[sortBy] || '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDeliverables, sortBy, sortOrder]);

  // Paginated Deliverables
  const paginatedDeliverables = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedDeliverables.slice(startIndex, startIndex + pageSize);
  }, [sortedDeliverables, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedDeliverables.length / pageSize) || 1;

  // Single Actions
  const handleCreateDeliverable = async (delData: any) => {
    await DeliverableService.addDeliverable(delData);
    showToast('Deliverable Created', `Created package "${delData.title}" (${delData.version})`, 'success');
    loadData();
  };

  const handleDuplicate = async (id: string) => {
    const cloned = await DeliverableService.duplicateDeliverable(id);
    if (cloned) {
      showToast('Deliverable Duplicated', `Created clone "${cloned.title}"`, 'success');
      loadData();
    }
  };

  const handleArchive = async (id: string) => {
    const updated = await DeliverableService.archiveDeliverable(id);
    if (updated) {
      showToast('Status Updated', updated.isArchived ? 'Deliverable archived' : 'Deliverable restored', 'info');
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (deleteTargetId) {
      await DeliverableService.deleteDeliverable(deleteTargetId);
      showToast('Deliverable Deleted', 'Deliverable removed permanently.', 'info');
      setDeleteTargetId(null);
      loadData();
    }
  };

  const handleSubmitForReview = async (id: string) => {
    await DeliverableService.submitDeliverableClientReview(id, {});
    showToast('Submitted for Review', 'Deliverable package sent to client.', 'success');
    loadData();
  };

  const handleApprove = async (id: string) => {
    await DeliverableService.approveDeliverable(id, 'Approved via quick action');
    showToast('Deliverable Approved', 'Client approval recorded.', 'success');
    loadData();
  };

  const handleRequestRevision = async (id: string) => {
    await DeliverableService.requestDeliverableRevision(id, 'Revision requested via quick action');
    showToast('Revision Requested', 'Revisions logged for deliverable.', 'info');
    loadData();
  };

  // Bulk Selection Handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === paginatedDeliverables.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedDeliverables.map((d) => d.id));
    }
  };

  const handleBulkAction = async (action: 'archive' | 'delete' | 'submit' | 'mark_ready') => {
    if (selectedIds.length === 0) return;

    if (action === 'submit') {
      // Submit each deliverable individually to ensure proper status validation
      for (const id of selectedIds) {
        await DeliverableService.submitDeliverableClientReview(id, {});
      }
    } else if (action === 'archive') {
      await DeliverableService.bulkUpdateDeliverables(selectedIds, { type: 'archive' });
    } else if (action === 'delete') {
      await DeliverableService.bulkUpdateDeliverables(selectedIds, { type: 'delete' });
    } else if (action === 'mark_ready') {
      await DeliverableService.bulkUpdateDeliverables(selectedIds, { type: 'status', status: 'ready_for_review' });
    }

    showToast('Bulk Action Complete', `Updated ${selectedIds.length} deliverables`, 'success');
    setSelectedIds([]);
    loadData();
  };

  return (
    <div className="space-y-6 select-none pb-12">
      {/* Top Header & Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Deliverables & Client Approvals
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-bold text-emerald-400">
              Phase 7 Engine
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Manage client asset packages, version history, file attachments, and formal sign-offs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="shadow-lg shadow-emerald-500/10"
          >
            New Deliverable
          </Button>
        </div>
      </div>

      {/* Metric Cards Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 backdrop-blur-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">Total Deliverables</span>
            <h3 className="text-2xl font-black text-white mt-0.5">{totalCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 backdrop-blur-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-rose-400 font-medium">Overdue</span>
            <h3 className="text-2xl font-black text-rose-300 mt-0.5">{overdueCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 backdrop-blur-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-400 font-medium">Pending Review</span>
            <h3 className="text-2xl font-black text-amber-300 mt-0.5">{pendingReviewCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 backdrop-blur-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-400 font-medium">Signed Off & Approved</span>
            <h3 className="text-2xl font-black text-emerald-300 mt-0.5">{approvedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 backdrop-blur-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-rose-400 font-medium">Revisions Requested</span>
            <h3 className="text-2xl font-black text-rose-300 mt-0.5">{revisionRequestedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-zinc-950/70 border border-white/10 backdrop-blur-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-500" />
            <input
              type="text"
              placeholder="Search deliverables, client, project, version..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Controls: Sort, View Toggle, Archive Toggle */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Sort Field */}
            <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-white focus:outline-none cursor-pointer"
              >
                <option value="dueDate" className="bg-zinc-900">Sort: Due Date</option>
                <option value="createdAt" className="bg-zinc-900">Sort: Created Date</option>
                <option value="title" className="bg-zinc-900">Sort: Title</option>
                <option value="status" className="bg-zinc-900">Sort: Status</option>
                <option value="version" className="bg-zinc-900">Sort: Version</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="text-zinc-400 hover:text-white ml-1"
                title="Toggle sort direction"
                aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>

            {/* Layout Mode Toggle */}
            <div className="flex items-center rounded-xl bg-white/[0.04] border border-white/10 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white'
                }`}
                title="Table View"
                aria-label="Switch to table view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white'
                }`}
                title="Grid View"
                aria-label="Switch to grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Dropdowns Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-white/5 text-xs">
          {/* Client Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              Client
            </label>
            <select
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none"
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company || c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Delivery Status Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              Delivery Status
            </label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none"
            >
              <option value="all">All Delivery Statuses</option>
              <option value="draft">Draft</option>
              <option value="ready_for_review">Ready for Review</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="revision_requested">Revision Requested</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Approval Status Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              Approval Status
            </label>
            <select
              value={selectedApprovalFilter}
              onChange={(e) => setSelectedApprovalFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none"
            >
              <option value="all">All Approval States</option>
              <option value="pending">Pending</option>
              <option value="viewed">Viewed</option>
              <option value="approved">Approved</option>
              <option value="revision_requested">Revision Requested</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-white focus:outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          {/* Archive Toggle */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/20"
              />
              <span>Include Archived</span>
            </label>
          </div>
        </div>
      </div>

      {/* Bulk Toolbar */}
      {selectedIds.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-xl flex items-center justify-between text-xs animate-in fade-in">
          <span className="font-semibold text-emerald-300">
            {selectedIds.length} deliverable{selectedIds.length > 1 ? 's' : ''} selected
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction('submit')}
              className="text-xs text-purple-300 border-purple-500/30"
            >
              Submit Selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction('archive')}
              className="text-xs text-zinc-300"
            >
              Archive Selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction('delete')}
              className="text-xs text-rose-300 border-rose-500/30"
            >
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Area: Table vs Grid */}
      {viewMode === 'table' ? (
        <DeliverablesTable
          deliverables={paginatedDeliverables}
          clients={clients}
          projects={projects}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onOpenWorkspace={(del) => setActiveWorkspaceDeliverableId(del.id)}
          onDuplicate={handleDuplicate}
          onArchive={handleArchive}
          onDelete={handleDelete}
          onSubmitForReview={handleSubmitForReview}
          onApprove={handleApprove}
          onRequestRevision={handleRequestRevision}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedDeliverables.map((del) => (
            <DeliverableCard
              key={del.id}
              deliverable={del}
              clients={clients}
              projects={projects}
              isSelected={selectedIds.includes(del.id)}
              onToggleSelect={handleToggleSelect}
              onOpenWorkspace={(d) => setActiveWorkspaceDeliverableId(d.id)}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onSubmitForReview={handleSubmitForReview}
              onApprove={handleApprove}
              onRequestRevision={handleRequestRevision}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>
      )}

      {/* Modals */}

      {/* Create Deliverable Modal */}
      <CreateDeliverableModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        clients={clients}
        projects={projects}
        onCreate={handleCreateDeliverable}
      />

      {/* Deliverable Workspace Detail Modal */}
      {activeWorkspaceDeliverableId && (
        <DeliverableWorkspaceModal
          isOpen={!!activeWorkspaceDeliverableId}
          onClose={() => setActiveWorkspaceDeliverableId(null)}
          deliverableId={activeWorkspaceDeliverableId}
          clients={clients}
          projects={projects}
          onRefresh={loadData}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title="Delete Deliverable Package"
        description="Are you sure you want to permanently delete this deliverable and all attached version histories?"
        confirmLabel="Delete Deliverable"
      />
    </div>
  );
};
