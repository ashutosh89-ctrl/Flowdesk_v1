import React, { useState, useEffect } from 'react';
import { Card } from '@/frontend/shared/ui/card';
import { Button } from '@/frontend/shared/ui/button';
import { Input } from '@/frontend/shared/ui/input';
import { Modal } from '@/frontend/shared/ui/modal';
import { Client } from '@/shared/types';
import { FreelancerClientManagementService as ClientService } from '@/backend/freelancer';
import { useToast } from '@/frontend/shared/ui/toast';
import { Plus, Users } from 'lucide-react';
import { SearchBar } from './components/search-bar';
import { FilterBar } from './components/filter-bar';
import { ClientCard } from './components/client-card';
import { ClientTable } from './components/client-table';
import { CountrySelect } from '@/frontend/shared/ui/country-select';
import { PhoneInput } from '@/frontend/shared/ui/phone-input';
import { switchCountryPrefix } from '@/shared/utils/countries';

export interface ClientsListViewProps {
  onOpenWorkspace: (clientId: string) => void;
}

export const ClientsListView: React.FC<ClientsListViewProps> = ({ onOpenWorkspace }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'company' | 'totalBilled' | 'createdAt' | 'activeProjects'>('company');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('India');
  const [currency, setCurrency] = useState('USD');
  const [notes, setNotes] = useState('');
  const [tagsStr, setTagsStr] = useState('');

  const { showToast } = useToast();

  const loadClients = React.useCallback(() => {
    ClientService.getClients().then(setClients);
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Extract available industries
  const availableIndustries = Array.from(
    new Set(clients.map((c) => c.industry).filter((ind): ind is string => Boolean(ind)))
  );

  // Filter & Search Logic
  const filteredClients = clients.filter((c) => {
    const query = search.toLowerCase();
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(query) ||
      c.company.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      (c.phone && c.phone.toLowerCase().includes(query)) ||
      (c.country && c.country.toLowerCase().includes(query)) ||
      (c.industry && c.industry.toLowerCase().includes(query)) ||
      (c.tags && c.tags.some((t) => t.toLowerCase().includes(query))) ||
      (c.notes && c.notes.toLowerCase().includes(query));

    const matchesStatus =
      statusFilter === 'all'
        ? !c.isArchived && c.status !== 'pending_deletion'
        : statusFilter === 'archived'
        ? c.isArchived || c.status === 'archived'
        : statusFilter === 'deleted'
        ? c.status === 'pending_deletion'
        : c.status === statusFilter && !c.isArchived && c.status !== 'pending_deletion';

    const matchesHealth =
      healthFilter === 'all' || (c.healthBadge && c.healthBadge.toLowerCase() === healthFilter);

    const matchesIndustry = industryFilter === 'all' || c.industry === industryFilter;

    return matchesSearch && matchesStatus && matchesHealth && matchesIndustry;
  });

  // Sort Logic
  const sortedClients = [...filteredClients].sort((a, b) => {
    let comp = 0;
    if (sortBy === 'company') {
      comp = a.company.localeCompare(b.company);
    } else if (sortBy === 'totalBilled') {
      comp = a.totalBilled - b.totalBilled;
    } else if (sortBy === 'activeProjects') {
      comp = a.activeProjectsCount - b.activeProjectsCount;
    } else {
      comp = a.createdAt.localeCompare(b.createdAt);
    }
    return sortOrder === 'asc' ? comp : -comp;
  });

  // Pagination Logic
  const totalPages = Math.ceil(sortedClients.length / itemsPerPage) || 1;
  const paginatedClients = sortedClients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    const newClient = await ClientService.createClient({
      name,
      company,
      email,
      phone,
      industry,
      status: 'active',
      healthBadge: 'healthy',
      activeProjectsCount: 0,
      country,
      currency,
      notes,
      tags,
    });

    showToast('Workspace Provisioned', `Client workspace for ${company} created.`, 'success');
    setIsCreateModalOpen(false);
    resetForm();
    loadClients();
    onOpenWorkspace(newClient.id);
  };

  const handleOpenEdit = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClient(client);
    setName(client.name);
    setCompany(client.company);
    setEmail(client.email);
    setPhone(client.phone || '');
    setIndustry(client.industry || '');
    setCountry(client.country);
    setCurrency(client.currency);
    setNotes(client.notes || '');
    setTagsStr(client.tags ? client.tags.join(', ') : '');
    setIsEditModalOpen(true);
  };

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);

    await ClientService.updateClient(editingClient.id, {
      name,
      company,
      email,
      phone,
      industry,
      country,
      currency,
      notes,
      tags,
    });

    showToast('Client Updated', `${company} details saved.`, 'info');
    setIsEditModalOpen(false);
    setEditingClient(null);
    resetForm();
    loadClients();
  };

  const handleDuplicateClient = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const dup = await ClientService.createClient({
      name: `${client.name} (Copy)`,
      company: `${client.company} (Copy)`,
      email: `copy.${client.email}`,
      phone: client.phone,
      industry: client.industry,
      status: 'active',
      healthBadge: 'healthy',
      activeProjectsCount: 0,
      country: client.country,
      currency: client.currency,
      notes: client.notes,
      tags: client.tags,
    });
    showToast('Client Duplicated', `Created clone workspace "${dup.company}".`, 'success');
    loadClients();
  };

  const handleArchiveClient = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    if (client.isArchived || client.status === 'archived' || client.status === 'pending_deletion') {
      await ClientService.restoreClient(client.id);
      showToast('Client Restored', `${client.company} restored to active clients.`, 'success');
    } else {
      await ClientService.archiveClient(client.id);
      showToast('Client Archived', `${client.company} archived.`, 'info');
    }
    loadClients();
  };

  const handleDeleteClient = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingClient(client);
  };

  const confirmDeleteClient = async () => {
    if (!deletingClient) return;
    await ClientService.deleteClient(deletingClient.id);
    showToast('Client Workspace Deleted', `${deletingClient.company} deleted.`, 'error');
    setDeletingClient(null);
    loadClients();
  };

  const handleCopyConnectionLink = async (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await ClientService.getOrCreateConnectionLink(client.id);
      if (res.success && res.url) {
        await navigator.clipboard.writeText(res.url);
        showToast('Connection Link Copied', 'One-time client connection link copied to clipboard.', 'success');
      } else {
        showToast('Error', res.error || 'Failed to get connection link', 'error');
      }
    } catch (err: any) {
      showToast('Error', err.message || 'Failed to copy connection link', 'error');
    }
  };

  const resetForm = () => {
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setIndustry('');
    setCountry('India');
    setCurrency('USD');
    setNotes('');
    setTagsStr('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-white" />
            Clients Directory
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage client operating workspaces, total revenue, health scores, and dedicated portals.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Client Workspace
        </Button>
      </div>

      {/* Search Input Bar */}
      <SearchBar
        value={search}
        onChange={(val) => {
          setSearch(val);
          setCurrentPage(1);
        }}
        totalResults={sortedClients.length}
      />

      {/* Filter, Sort & View Mode Bar */}
      <FilterBar
        statusFilter={statusFilter}
        onStatusFilterChange={(st) => {
          setStatusFilter(st);
          setCurrentPage(1);
        }}
        healthFilter={healthFilter}
        onHealthFilterChange={(hl) => {
          setHealthFilter(hl);
          setCurrentPage(1);
        }}
        industryFilter={industryFilter}
        onIndustryFilterChange={(ind) => {
          setIndustryFilter(ind);
          setCurrentPage(1);
        }}
        availableIndustries={availableIndustries}
        sortBy={sortBy}
        onSortByChange={(sb) => setSortBy(sb)}
        sortOrder={sortOrder}
        onToggleSortOrder={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
        viewMode={viewMode}
        onViewModeChange={(m) => setViewMode(m)}
      />

      {/* Main Clients View: Grid or Table */}
      {viewMode === 'grid' ? (
        <div className="space-y-6">
          {paginatedClients.length === 0 ? (
            <Card variant="crystal" className="p-12 text-center text-zinc-400">
              No clients found matching your search and filter criteria.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedClients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onOpenWorkspace={onOpenWorkspace}
                  onEdit={handleOpenEdit}
                  onDuplicate={handleDuplicateClient}
                  onArchive={handleArchiveClient}
                  onDelete={handleDeleteClient}
                  onCopyConnectionLink={handleCopyConnectionLink}
                />
              ))}
            </div>
          )}

          {/* Grid View Pagination */}
          <div className="flex items-center justify-between p-4 bg-zinc-900/60 border border-white/10 rounded-xl text-xs text-zinc-400 font-mono">
            <span>
              SHOWING <strong className="text-white">{paginatedClients.length}</strong> OF{' '}
              <strong className="text-white">{sortedClients.length}</strong> CLIENTS
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <ClientTable
          clients={paginatedClients}
          totalClientsCount={sortedClients.length}
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={(p) => setCurrentPage(p)}
          onOpenWorkspace={onOpenWorkspace}
          onEdit={handleOpenEdit}
          onDuplicate={handleDuplicateClient}
          onArchive={handleArchiveClient}
          onDelete={handleDeleteClient}
          onCopyConnectionLink={handleCopyConnectionLink}
        />
      )}

      {/* Create Client Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Add New Client Workspace">
        <form onSubmit={handleCreateClient} className="space-y-4">
          <Input
            label="Client Primary Contact"
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
            <PhoneInput
              label="Phone"
              value={phone}
              country={country}
              onChange={(newPhone) => setPhone(newPhone)}
            />
            <Input label="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Fintech" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CountrySelect
              label="Country"
              value={country}
              onChange={(newCountry) => {
                const updatedPhone = switchCountryPrefix(phone, country, newCountry);
                setCountry(newCountry);
                setPhone(updatedPhone);
              }}
            />
            <Input label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>

          <Input
            label="Tags (comma separated)"
            placeholder="Enterprise, VIP, Retainer"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
          />

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
              Provision Client Workspace
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
            <PhoneInput
              label="Phone"
              value={phone}
              country={country}
              onChange={(newPhone) => setPhone(newPhone)}
            />
            <Input label="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CountrySelect
              label="Country"
              value={country}
              onChange={(newCountry) => {
                const updatedPhone = switchCountryPrefix(phone, country, newCountry);
                setCountry(newCountry);
                setPhone(updatedPhone);
              }}
            />
            <Input label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>

          <Input
            label="Tags (comma separated)"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
          />

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
