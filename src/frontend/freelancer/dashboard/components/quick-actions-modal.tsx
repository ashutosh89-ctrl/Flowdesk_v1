import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Users,
  FolderKanban,
  FileText,
  Receipt,
  FileSearch,
  X,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  FreelancerClientService,
  FreelancerProjectService,
  FreelancerDeliverableService,
  FreelancerInvoiceService,
  FreelancerDocumentService,
} from '@/backend/freelancer';
import { useToast } from '@/frontend/shared/ui/toast';

interface QuickActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onRefresh?: () => void;
}

export const QuickActionsModal: React.FC<QuickActionsModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onRefresh,
}) => {
  const { showToast } = useToast();
  const [activeForm, setActiveForm] = useState<
    'select' | 'new_client' | 'new_project' | 'new_deliverable' | 'new_invoice' | 'new_doc'
  >('select');

  // Submission states (one per workflow)
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingDeliverable, setIsCreatingDeliverable] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);

  // Error states
  const [clientError, setClientError] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [deliverableError, setDeliverableError] = useState<string | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  // Form State
  const [clientName, setClientName] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  const [projectTitle, setProjectTitle] = useState('');
  const [projectClient, setProjectClient] = useState('');
  const [projectBudget, setProjectBudget] = useState('15000');

  const [delivTitle, setDelivTitle] = useState('');
  const [delivClient, setDelivClient] = useState('');

  const [invClient, setInvClient] = useState('');
  const [invAmount, setInvAmount] = useState('5000');

  const [docTitle, setDocTitle] = useState('');
  const [docClient, setDocClient] = useState('');
  const [docType, setDocType] = useState<string>('brief');

  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);

  React.useEffect(() => {
    if (isOpen && !clientsLoaded) {
      FreelancerClientService.getClients().then((c) => { setClients(c); setClientsLoaded(true); });
    }
  }, [isOpen, clientsLoaded]);

  const resetClientForm = () => {
    setClientName('');
    setClientCompany('');
    setClientEmail('');
    setClientError(null);
  };

  const resetProjectForm = () => {
    setProjectTitle('');
    setProjectClient('');
    setProjectBudget('15000');
    setProjectError(null);
  };

  const resetDeliverableForm = () => {
    setDelivTitle('');
    setDelivClient('');
    setDeliverableError(null);
  };

  const resetInvoiceForm = () => {
    setInvClient('');
    setInvAmount('5000');
    setInvoiceError(null);
  };

  const resetDocForm = () => {
    setDocTitle('');
    setDocClient('');
    setDocType('brief');
    setDocError(null);
  };

  // ── CREATE CLIENT ──
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingClient) return;

    // Validate
    if (!clientName.trim() || !clientCompany.trim() || !clientEmail.trim()) {
      setClientError('All fields are required.');
      return;
    }

    setIsCreatingClient(true);
    setClientError(null);

    try {
      await FreelancerClientService.createClient({
        name: clientName.trim(),
        company: clientCompany.trim(),
        email: clientEmail.trim(),
        phone: '',
        status: 'active',
        healthBadge: 'healthy',
        activeProjectsCount: 0,
        currency: 'USD',
        country: 'India',
      });

      showToast('Client Created', `"${clientCompany.trim()}" has been added to your workspace.`, 'success');
      if (onRefresh) onRefresh();
      resetClientForm();
      onClose();
      onNavigate('clients');
    } catch (err: any) {
      console.error('Create client error:', err);
      const msg = err?.message || 'Unable to create the client. Please check your information and try again.';
      setClientError(msg);
      showToast('Create Failed', msg, 'error');
    } finally {
      setIsCreatingClient(false);
    }
  };

  // ── CREATE PROJECT ──
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingProject) return;

    if (!projectTitle.trim()) {
      setProjectError('Project name is required.');
      return;
    }

    setIsCreatingProject(true);
    setProjectError(null);

    try {
      const client = clients.find((c) => c.id === projectClient) || clients[0];
      await FreelancerProjectService.createProject({
        title: projectTitle.trim(),
        description: '',
        clientId: client ? client.id : 'cli-1',
        clientName: client ? (client as any).company || client.name : 'Client Workspace',
        status: 'in_progress',
        budget: parseFloat(projectBudget) || 15000,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        tags: [],
      });

      showToast('Project Created', `"${projectTitle.trim()}" has been created.`, 'success');
      if (onRefresh) onRefresh();
      resetProjectForm();
      onClose();
      onNavigate('projects');
    } catch (err: any) {
      console.error('Create project error:', err);
      const msg = err?.message || 'Unable to create the project. Please try again.';
      setProjectError(msg);
      showToast('Create Failed', msg, 'error');
    } finally {
      setIsCreatingProject(false);
    }
  };

  // ── CREATE DELIVERABLE ──
  const handleCreateDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingDeliverable) return;

    if (!delivTitle.trim()) {
      setDeliverableError('Deliverable title is required.');
      return;
    }

    setIsCreatingDeliverable(true);
    setDeliverableError(null);

    try {
      const client = clients.find((c) => c.id === delivClient) || clients[0];
      await FreelancerDeliverableService.addDeliverable({
        clientId: client ? client.id : 'cli-1',
        clientName: client ? (client as any).company || client.name : 'Client Workspace',
        projectId: '',
        title: delivTitle.trim(),
        description: '',
        status: 'draft',
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        version: 'v1.0',
      });

      showToast('Deliverable Created', `"${delivTitle.trim()}" package has been created.`, 'success');
      if (onRefresh) onRefresh();
      resetDeliverableForm();
      onClose();
      onNavigate('deliverables');
    } catch (err: any) {
      console.error('Create deliverable error:', err);
      const msg = err?.message || 'Unable to create the deliverable. Please try again.';
      setDeliverableError(msg);
      showToast('Create Failed', msg, 'error');
    } finally {
      setIsCreatingDeliverable(false);
    }
  };

  // ── CREATE INVOICE ──
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingInvoice) return;

    if (!invClient) {
      setInvoiceError('Please select a client.');
      return;
    }

    const amount = parseFloat(invAmount);
    if (!amount || amount <= 0) {
      setInvoiceError('Please enter a valid amount.');
      return;
    }

    setIsCreatingInvoice(true);
    setInvoiceError(null);

    try {
      const client = clients.find((c) => c.id === invClient) || clients[0];
      await FreelancerInvoiceService.createInvoice({
        clientId: client ? client.id : 'cli-1',
        clientName: client ? (client as any).company || client.name : 'Client Workspace',
        clientEmail: client ? client.email : 'client@example.com',
        projectId: '',
        projectName: '',
        invoiceNumber: `INV-${Date.now()}`,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        items: [
          {
            description: 'Design Engineering & Deliverables Handover',
            quantity: 1,
            rate: amount,
            amount,
          },
        ],
        taxPercentage: 10,
        notes: 'Thank you for your business. Payment due within 14 days.',
      });

      showToast('Invoice Created', `Invoice for $${amount.toLocaleString()} has been generated.`, 'success');
      if (onRefresh) onRefresh();
      resetInvoiceForm();
      onClose();
      onNavigate('invoices');
    } catch (err: any) {
      console.error('Create invoice error:', err);
      const msg = err?.message || 'Unable to create the invoice. Please verify the client and amount.';
      setInvoiceError(msg);
      showToast('Create Failed', msg, 'error');
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  // ── REQUEST DOCUMENT ──
  const handleRequestDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingDoc) return;

    if (!docTitle.trim()) {
      setDocError('Document title is required.');
      return;
    }

    setIsCreatingDoc(true);
    setDocError(null);

    try {
      const client = clients.find((c) => c.id === docClient) || clients[0];
      if (!client) {
        setDocError('No client available. Create a client first.');
        return;
      }

      await FreelancerDocumentService.requestDocument(client.id, {
        title: docTitle.trim(),
        type: docType as any,
        isRequired: true,
      });

      showToast('Document Requested', `"${docTitle.trim()}" request sent to ${client.company || client.name}.`, 'success');
      if (onRefresh) onRefresh();
      resetDocForm();
      onClose();
      onNavigate('documents');
    } catch (err: any) {
      console.error('Request document error:', err);
      const msg = err?.message || 'Unable to request the document. Please try again.';
      setDocError(msg);
      showToast('Request Failed', msg, 'error');
    } finally {
      setIsCreatingDoc(false);
    }
  };

  const actions = [
    {
      id: 'new_client',
      title: 'Create Client Workspace',
      description: 'Onboard a new client into FlowDesk',
      icon: <Users className="w-5 h-5 text-indigo-400" />,
      onClick: () => setActiveForm('new_client'),
    },
    {
      id: 'new_project',
      title: 'Create New Project',
      description: 'Set up milestones, budget & target deadlines',
      icon: <FolderKanban className="w-5 h-5 text-sky-400" />,
      onClick: () => setActiveForm('new_project'),
    },
    {
      id: 'new_deliverable',
      title: 'Generate Deliverable Package',
      description: 'Package design assets & files for review',
      icon: <FileText className="w-5 h-5 text-emerald-400" />,
      onClick: () => setActiveForm('new_deliverable'),
    },
    {
      id: 'new_invoice',
      title: 'Generate Invoice',
      description: 'Create line items and request client payment',
      icon: <Receipt className="w-5 h-5 text-amber-400" />,
      onClick: () => setActiveForm('new_invoice'),
    },
    {
      id: 'new_doc',
      title: 'Request Document',
      description: 'Request a document from a client workspace',
      icon: <FileSearch className="w-5 h-5 text-rose-400" />,
      onClick: () => setActiveForm('new_doc'),
    },
  ];

  const renderError = (error: string | null) => {
    if (!error) return null;
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -12 }}
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            className="relative w-full max-w-lg bg-zinc-950/95 border border-white/20 backdrop-blur-3xl rounded-2xl shadow-2xl overflow-hidden z-10 p-6"
          >
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Quick Actions &amp; Create</h3>
                  <p className="text-xs text-zinc-400">Instant workflow launchers for FlowDesk OS.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeForm === 'select' && (
              <div className="space-y-3">
                {actions.map((act) => (
                  <button
                    key={act.id}
                    onClick={act.onClick}
                    className="w-full p-4 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-white/10 hover:border-white/20 transition-all text-left flex items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover:scale-105 transition-transform">
                        {act.icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                          {act.title}
                        </h4>
                        <p className="text-xs text-zinc-400">{act.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {activeForm === 'new_client' && (
              <form onSubmit={handleCreateClient} className="space-y-4">
                {renderError(clientError)}
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Company / Brand Name *</label>
                  <input
                    type="text"
                    required
                    value={clientCompany}
                    onChange={(e) => setClientCompany(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    disabled={isCreatingClient}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Primary Contact Name *</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    disabled={isCreatingClient}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Contact Email *</label>
                  <input
                    type="email"
                    required
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="sarah@acme.com"
                    disabled={isCreatingClient}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setActiveForm('select'); resetClientForm(); }}
                    className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                    disabled={isCreatingClient}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingClient}
                    className="px-4 py-2 bg-white hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingClient ? 'Creating...' : 'Create Client Workspace'}
                  </button>
                </div>
              </form>
            )}

            {activeForm === 'new_project' && (
              <form onSubmit={handleCreateProject} className="space-y-4">
                {renderError(projectError)}
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Project Name *</label>
                  <input
                    type="text"
                    required
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    placeholder="e.g. Mobile App Redesign v2"
                    disabled={isCreatingProject}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Assign Client</label>
                  <select
                    value={projectClient}
                    onChange={(e) => setProjectClient(e.target.value)}
                    disabled={isCreatingProject}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company} ({c.name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Total Budget ($)</label>
                  <input
                    type="number"
                    value={projectBudget}
                    onChange={(e) => setProjectBudget(e.target.value)}
                    disabled={isCreatingProject}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setActiveForm('select'); resetProjectForm(); }}
                    className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                    disabled={isCreatingProject}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingProject}
                    className="px-4 py-2 bg-white hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingProject ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            )}

            {activeForm === 'new_deliverable' && (
              <form onSubmit={handleCreateDeliverable} className="space-y-4">
                {renderError(deliverableError)}
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Deliverable Title *</label>
                  <input
                    type="text"
                    required
                    value={delivTitle}
                    onChange={(e) => setDelivTitle(e.target.value)}
                    placeholder="e.g. Design Token Specification Package"
                    disabled={isCreatingDeliverable}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Assign Client Workspace</label>
                  <select
                    value={delivClient}
                    onChange={(e) => setDelivClient(e.target.value)}
                    disabled={isCreatingDeliverable}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setActiveForm('select'); resetDeliverableForm(); }}
                    className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                    disabled={isCreatingDeliverable}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingDeliverable}
                    className="px-4 py-2 bg-white hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingDeliverable ? 'Creating...' : 'Generate Deliverable Package'}
                  </button>
                </div>
              </form>
            )}

            {activeForm === 'new_invoice' && (
              <form onSubmit={handleCreateInvoice} className="space-y-4">
                {renderError(invoiceError)}
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Select Client *</label>
                  <select
                    value={invClient}
                    onChange={(e) => setInvClient(e.target.value)}
                    disabled={isCreatingInvoice}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Total Amount ($) *</label>
                  <input
                    type="number"
                    value={invAmount}
                    onChange={(e) => setInvAmount(e.target.value)}
                    disabled={isCreatingInvoice}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setActiveForm('select'); resetInvoiceForm(); }}
                    className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                    disabled={isCreatingInvoice}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingInvoice}
                    className="px-4 py-2 bg-white hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingInvoice ? 'Creating...' : 'Generate Invoice'}
                  </button>
                </div>
              </form>
            )}

            {activeForm === 'new_doc' && (
              <form onSubmit={handleRequestDocument} className="space-y-4">
                {renderError(docError)}
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Document Title *</label>
                  <input
                    type="text"
                    required
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="e.g. Brand Guidelines PDF"
                    disabled={isCreatingDoc}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Request From Client</label>
                  <select
                    value={docClient}
                    onChange={(e) => setDocClient(e.target.value)}
                    disabled={isCreatingDoc}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Document Type</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    disabled={isCreatingDoc}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="brief">Brief</option>
                    <option value="contract">Contract</option>
                    <option value="proposal">Proposal</option>
                    <option value="nda">NDA</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setActiveForm('select'); resetDocForm(); }}
                    className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                    disabled={isCreatingDoc}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingDoc}
                    className="px-4 py-2 bg-white hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingDoc ? 'Requesting...' : 'Request Document'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
