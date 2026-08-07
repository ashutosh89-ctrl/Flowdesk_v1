import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Users,
  FolderKanban,
  FileText,
  Receipt,
  FileSearch,
  FolderPlus,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { FlowDeskStore } from '../../../services/storage-store';

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
  const [activeForm, setActiveForm] = useState<
    'select' | 'new_client' | 'new_project' | 'new_deliverable' | 'new_invoice' | 'new_doc'
  >('select');

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

  const clients = FlowDeskStore.getClients();

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientCompany || !clientEmail) return;
    FlowDeskStore.createClient({
      name: clientName,
      company: clientCompany,
      email: clientEmail,
      phone: '+1 (555) 019-2831',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      status: 'active',
      healthBadge: 'healthy',
      activeProjectsCount: 1,
      currency: 'USD',
      country: 'United States',
    });
    setClientName('');
    setClientCompany('');
    setClientEmail('');
    if (onRefresh) onRefresh();
    onNavigate('clients');
    onClose();
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectTitle) return;
    const client = clients.find((c) => c.id === projectClient) || clients[0];
    FlowDeskStore.createProject({
      title: projectTitle,
      description: 'FlowDesk OS Quick Created Project.',
      clientId: client ? client.id : 'cli-1',
      clientName: client ? client.company : 'Client Workspace',
      status: 'in_progress',
      budget: parseFloat(projectBudget) || 15000,
      startDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      tags: ['Design System', 'UI/UX'],
    });
    setProjectTitle('');
    if (onRefresh) onRefresh();
    onNavigate('projects');
    onClose();
  };

  const handleCreateDeliverable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!delivTitle) return;
    const client = clients.find((c) => c.id === delivClient) || clients[0];
    FlowDeskStore.addDeliverable({
      clientId: client ? client.id : 'cli-1',
      clientName: client ? client.company : 'Client Workspace',
      projectId: 'proj-1',
      title: delivTitle,
      description: 'Quick action created deliverable package.',
      status: 'draft',
      approvalStatus: 'pending',
      priority: 'high',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      version: 'v1.0.0',
    });
    setDelivTitle('');
    if (onRefresh) onRefresh();
    onNavigate('deliverables');
    onClose();
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === invClient) || clients[0];
    FlowDeskStore.createInvoice({
      clientId: client ? client.id : 'cli-1',
      clientName: client ? client.company : 'Client Workspace',
      clientEmail: client ? client.email : 'client@example.com',
      projectId: 'proj-1',
      projectName: 'Enterprise Workspace Phase',
      invoiceNumber: `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      items: [
        {
          id: `item-${Date.now()}`,
          description: 'Design Engineering & Deliverables Handover',
          quantity: 1,
          rate: parseFloat(invAmount) || 5000,
          amount: parseFloat(invAmount) || 5000,
        },
      ],
      taxPercentage: 10,
      notes: 'Thank you for your business. Payment due within 14 days.',
    });
    if (onRefresh) onRefresh();
    onNavigate('invoices');
    onClose();
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
  ];

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
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Company / Brand Name</label>
                  <input
                    type="text"
                    required
                    value={clientCompany}
                    onChange={(e) => setClientCompany(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Primary Contact Name</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Sarah Connor"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Contact Email</label>
                  <input
                    type="email"
                    required
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="sarah@acme.com"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveForm('select')}
                    className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-white hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md"
                  >
                    Create Client Workspace
                  </button>
                </div>
              </form>
            )}

            {activeForm === 'new_project' && (
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Project Name</label>
                  <input
                    type="text"
                    required
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    placeholder="e.g. Mobile App Redesign v2"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Assign Client</label>
                  <select
                    value={projectClient}
                    onChange={(e) => setProjectClient(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
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
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveForm('select')}
                    className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-white hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md"
                  >
                    Create Project
                  </button>
                </div>
              </form>
            )}

            {activeForm === 'new_deliverable' && (
              <form onSubmit={handleCreateDeliverable} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Deliverable Title</label>
                  <input
                    type="text"
                    required
                    value={delivTitle}
                    onChange={(e) => setDelivTitle(e.target.value)}
                    placeholder="e.g. Design Token Specification Package"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Assign Client Workspace</label>
                  <select
                    value={delivClient}
                    onChange={(e) => setDelivClient(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
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
                    onClick={() => setActiveForm('select')}
                    className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-white hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md"
                  >
                    Generate Deliverable Package
                  </button>
                </div>
              </form>
            )}

            {activeForm === 'new_invoice' && (
              <form onSubmit={handleCreateInvoice} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Select Client</label>
                  <select
                    value={invClient}
                    onChange={(e) => setInvClient(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1">Total Amount ($)</label>
                  <input
                    type="number"
                    value={invAmount}
                    onChange={(e) => setInvAmount(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveForm('select')}
                    className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-white hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-md"
                  >
                    Generate Invoice
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
