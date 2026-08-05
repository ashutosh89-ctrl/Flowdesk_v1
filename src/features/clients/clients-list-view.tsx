import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { StatusPill } from '../../components/ui/status-pill';
import { Avatar } from '../../components/ui/avatar';
import { Modal } from '../../components/ui/modal';
import { ClientService } from '../../services';
import { Client } from '../../types';
import {
  Search,
  Plus,
  ArrowUpRight,
  Building,
  Mail,
  Globe,
  MoreVertical,
  Edit,
  Archive,
  RotateCcw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  HeartPulse,
} from 'lucide-react';
import { useToast } from '../../components/ui/toast';

export interface ClientsListViewProps {
  onOpenWorkspace: (clientId: string) => void;
}

export const ClientsListView: React.FC<ClientsListViewProps> = ({ onOpenWorkspace }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'company' | 'totalBilled' | 'createdAt'>('company');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);

  const { showToast } = useToast();

  // New/Edit Client Form State
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('United States');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');

  const loadClients = () => {
    ClientService.getClients().then(setClients);
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    ClientService.createClient({
      name,
      company,
      email,
      country,
      currency,
      notes,
      status: 'active',
      activeProjectsCount: 1,
    }).then((newClient) => {
      showToast('Workspace Created', `Client workspace for ${company} ready.`, 'success');
      setIsCreateModalOpen(false);
      resetForm();
      loadClients();
    });
  };

  const handleEditClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    ClientService.updateClient(editingClient.id, {
      name,
      company,
      email,
      country,
      currency,
      notes,
    }).then(() => {
      showToast('Client Updated', `Client ${company} details saved.`, 'success');
      setIsEditModalOpen(false);
      setEditingClient(null);
      resetForm();
      loadClients();
    });
  };

  const handleOpenEdit = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClient(client);
    setName(client.name);
    setCompany(client.company);
    setEmail(client.email);
    setCountry(client.country || 'United States');
    setCurrency(client.currency || 'USD');
    setNotes(client.notes || '');
    setIsEditModalOpen(true);
  };

  const handleArchiveClient = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    if (client.isArchived || client.status === 'archived') {
      ClientService.restoreClient(client.id).then(() => {
        showToast('Client Restored', `${client.company} has been restored to active clients.`, 'success');
        loadClients();
      });
    } else {
      ClientService.archiveClient(client.id).then(() => {
        showToast('Client Archived', `${client.company} archived successfully.`, 'info');
        loadClients();
      });
    }
  };

  const handleDeleteClient = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingClient(client);
  };

  const confirmDeleteClient = () => {
    if (!deletingClient) return;
    ClientService.deleteClient(deletingClient.id).then(() => {
      showToast('Client Deleted', `${deletingClient.company} workspace removed permanently.`, 'info');
      setDeletingClient(null);
      loadClients();
    });
  };

  const resetForm = () => {
    setName('');
    setCompany('');
    setEmail('');
    setNotes('');
    setCountry('United States');
    setCurrency('USD');
  };

  // Filter, Sort & Paginate
  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.notes && c.notes.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all'
        ? !c.isArchived
        : statusFilter === 'archived'
        ? c.isArchived || c.status === 'archived'
        : c.status === statusFilter && !c.isArchived;

    return matchesSearch && matchesStatus;
  });

  const sortedClients = [...filteredClients].sort((a, b) => {
    if (sortBy === 'company') {
      return sortOrder === 'asc' ? a.company.localeCompare(b.company) : b.company.localeCompare(a.company);
    } else if (sortBy === 'totalBilled') {
      return sortOrder === 'asc' ? a.totalBilled - b.totalBilled : b.totalBilled - a.totalBilled;
    } else {
      return sortOrder === 'asc' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
    }
  });

  const totalPages = Math.ceil(sortedClients.length / itemsPerPage) || 1;
  const paginatedClients = sortedClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const renderHealthBadge = (health?: string) => {
    if (health === 'risk') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-mono">
          <AlertTriangle className="w-3 h-3 text-red-400" /> At Risk
        </span>
      );
    }
    if (health === 'attention') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono">
          <HeartPulse className="w-3 h-3 text-amber-400" /> Attention
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
        <ShieldCheck className="w-3 h-3 text-emerald-400" /> Healthy
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Clients Directory</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage client accounts, total billed, workspace health, and dedicated hubs.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
          Add Client Workspace
        </Button>
      </div>

      {/* Filter, Search & Sort Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="w-full lg:w-80">
          <Input
            type="search"
            placeholder="Search company, contact, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            onClear={() => setSearch('')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filters */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900/60 border border-white/10 rounded-xl">
            {['all', 'active', 'lead', 'inactive', 'archived'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                  statusFilter === st ? 'bg-white text-zinc-950 shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-400">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="company" className="bg-zinc-900">Company</option>
              <option value="totalBilled" className="bg-zinc-900">Total Billed</option>
              <option value="createdAt" className="bg-zinc-900">Date Added</option>
            </select>
          </div>
        </div>
      </div>

      {/* Client List Table View */}
      <Card variant="crystal" className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-zinc-400 font-mono uppercase text-[10px]">
                <th className="py-4 px-6 font-semibold">Client / Company</th>
                <th className="py-4 px-6 font-semibold">Contact & Location</th>
                <th className="py-4 px-6 font-semibold">Active Projects</th>
                <th className="py-4 px-6 font-semibold">Total Billed</th>
                <th className="py-4 px-6 font-semibold">Health</th>
                <th className="py-4 px-6 font-semibold">Status</th>
                <th className="py-4 px-6 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    No clients found matching your search criteria.
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => onOpenWorkspace(client.id)}
                    className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                  >
                    {/* Company & Avatar */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <Avatar name={client.name} src={client.avatarUrl} size="md" />
                        <div>
                          <h4 className="text-sm font-bold text-white group-hover:text-white flex items-center gap-1.5">
                            {client.company}
                          </h4>
                          <span className="text-zinc-400 text-[11px] font-mono">ID: {client.id}</span>
                        </div>
                      </div>
                    </td>

                    {/* Contact & Email */}
                    <td className="py-4 px-6">
                      <p className="font-semibold text-white">{client.name}</p>
                      <p className="text-zinc-400 text-[11px] flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-zinc-500" /> {client.email}
                      </p>
                    </td>

                    {/* Active Projects */}
                    <td className="py-4 px-6">
                      <span className="font-bold text-white text-sm">{client.activeProjectsCount}</span>
                      <span className="text-zinc-400 text-[11px] ml-1">active</span>
                    </td>

                    {/* Total Billed */}
                    <td className="py-4 px-6 font-bold text-white text-sm">
                      ${client.totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Health */}
                    <td className="py-4 px-6">{renderHealthBadge(client.healthBadge)}</td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <StatusPill status={client.status} />
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onOpenWorkspace(client.id)}
                          rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
                        >
                          Workspace
                        </Button>

                        <button
                          onClick={(e) => handleOpenEdit(client, e)}
                          title="Edit Client"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={(e) => handleArchiveClient(client, e)}
                          title={client.isArchived || client.status === 'archived' ? 'Restore Client' : 'Archive Client'}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          {client.isArchived || client.status === 'archived' ? (
                            <RotateCcw className="w-4 h-4" />
                          ) : (
                            <Archive className="w-4 h-4" />
                          )}
                        </button>

                        <button
                          onClick={(e) => handleDeleteClient(client, e)}
                          title="Delete Client"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer & Pagination */}
        <div className="p-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/[0.01]">
          <span className="text-xs text-zinc-400 font-mono">
            SHOWING <strong className="text-white">{paginatedClients.length}</strong> OF{' '}
            <strong className="text-white">{sortedClients.length}</strong> CLIENTS
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            >
              Prev
            </Button>

            <span className="text-xs text-zinc-400 font-mono px-2">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Create New Client Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Add New Client Workspace">
        <form onSubmit={handleCreateClient} className="space-y-4">
          <Input
            label="Client Contact Person"
            placeholder="e.g. Eleanor Vance"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Company / Studio Name"
            placeholder="e.g. Apex Digital Labs"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="eleanor@apexdigital.io"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
            <Input label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">Workspace Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal project requirements or preferences..."
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create Client Workspace
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Client Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Client Information">
        <form onSubmit={handleEditClient} className="space-y-4">
          <Input label="Contact Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Company Name" value={company} onChange={(e) => setCompany(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
            <Input label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-300">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deletingClient} onClose={() => setDeletingClient(null)} title="Delete Client Workspace">
        <div className="space-y-4">
          <p className="text-xs text-zinc-300">
            Are you sure you want to permanently delete <strong className="text-white">{deletingClient?.company}</strong>?
            This will remove all associated projects, deliverables, documents, and invoices.
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" onClick={() => setDeletingClient(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteClient}>
              Delete Workspace
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
