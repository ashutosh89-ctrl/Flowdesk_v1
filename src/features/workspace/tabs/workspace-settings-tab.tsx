import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { WorkspaceSummary, CustomField } from '../../../types';
import { ClientService } from '../../../services';
import { useToast } from '../../../components/ui/toast';
import {
  Settings,
  Building,
  Mail,
  Phone,
  Globe,
  DollarSign,
  Shield,
  Palette,
  Plus,
  Trash2,
  Archive,
  RotateCcw,
  Save,
  Tag,
} from 'lucide-react';

export interface WorkspaceSettingsTabProps {
  summary: WorkspaceSummary;
  onRefresh: () => void;
  onCloseWorkspace?: () => void;
}

export const WorkspaceSettingsTab: React.FC<WorkspaceSettingsTabProps> = ({
  summary,
  onRefresh,
  onCloseWorkspace,
}) => {
  const { client } = summary;
  const { showToast } = useToast();

  const [name, setName] = useState(client.name);
  const [company, setCompany] = useState(client.company);
  const [email, setEmail] = useState(client.email);
  const [phone, setPhone] = useState(client.phone || '');
  const [industry, setIndustry] = useState(client.industry || '');
  const [country, setCountry] = useState(client.country || 'United States');
  const [currency, setCurrency] = useState(client.currency || 'USD');
  const [notes, setNotes] = useState(client.notes || '');

  // Custom Fields manager
  const [customFields, setCustomFields] = useState<CustomField[]>(
    client.customFields || [
      { key: 'Tax Identification ID', value: 'US-948201948' },
      { key: 'Billing Cycle', value: 'Net 15 Days' },
    ]
  );
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  // Branding & Prefix
  const [logoUrl, setLogoUrl] = useState(client.logoUrl || client.avatarUrl || '');
  const [invoicePrefix, setInvoicePrefix] = useState(`INV-${client.company.substring(0, 3).toUpperCase()}`);
  const [portalTheme, setPortalTheme] = useState('Charcoal Glass');

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await ClientService.updateClient(client.id, {
      name,
      company,
      email,
      phone,
      industry,
      country,
      currency,
      notes,
      customFields,
      logoUrl,
    });
    showToast('Settings Saved', 'Workspace settings updated successfully.', 'success');
    onRefresh();
  };

  const handleAddCustomField = () => {
    if (!newKey || !newValue) return;
    setCustomFields([...customFields, { key: newKey, value: newValue }]);
    setNewKey('');
    setNewValue('');
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleArchive = async () => {
    if (client.isArchived || client.status === 'archived') {
      await ClientService.restoreClient(client.id);
      showToast('Client Restored', `${client.company} workspace restored to active.`, 'success');
    } else {
      await ClientService.archiveClient(client.id);
      showToast('Client Archived', `${client.company} moved to archived clients.`, 'info');
    }
    onRefresh();
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to permanently delete ${client.company}? This cannot be undone.`)) {
      await ClientService.deleteClient(client.id);
      showToast('Client Deleted', `${client.company} workspace deleted.`, 'error');
      if (onCloseWorkspace) onCloseWorkspace();
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-white" />
            Workspace Settings & Branding
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Configure client identity, custom metadata, portal branding, and administrative lifecycle.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Core Identity Card */}
        <Card variant="crystal" className="p-6 border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Building className="w-4 h-4 text-zinc-400" /> Primary Account Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Primary Contact Person" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Company / Business Name" value={company} onChange={(e) => setCompany(e.target.value)} required />
            <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
            <Input label="Industry / Sector" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Fintech" />
            <Input label="Country / Region" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-xs font-medium text-zinc-300">Workspace Internal Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
              placeholder="Internal client preferences, billing constraints..."
            />
          </div>
        </Card>

        {/* Currency & Financial Prefix Card */}
        <Card variant="crystal" className="p-6 border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-zinc-400" /> Financial & Invoice Configurations
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Default Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            <Input label="Invoice Number Prefix" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-300">Default Tax Rate (%)</label>
              <input
                type="number"
                defaultValue={0}
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>
        </Card>

        {/* Custom Metadata Fields Manager */}
        <Card variant="crystal" className="p-6 border-white/10 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Tag className="w-4 h-4 text-zinc-400" /> Custom Metadata Key-Value Fields
          </h3>

          <div className="space-y-2">
            {customFields.map((field, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/10 text-xs"
              >
                <div className="font-mono">
                  <span className="text-zinc-400 font-semibold">{field.key}:</span>{' '}
                  <span className="text-white font-bold ml-1">{field.value}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveCustomField(idx)}
                  className="p-1 text-zinc-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <Input
              placeholder="Field Key (e.g. VAT Reg)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
            <Input
              placeholder="Field Value (e.g. GB-99401)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
            <Button
              variant="secondary"
              type="button"
              onClick={handleAddCustomField}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Key-Value
            </Button>
          </div>
        </Card>

        {/* Save Bar */}
        <div className="flex items-center justify-end">
          <Button variant="primary" type="submit" leftIcon={<Save className="w-4 h-4" />}>
            Save Workspace Settings
          </Button>
        </div>
      </form>

      {/* Danger & Lifecycle Zone */}
      <Card variant="crystal" className="p-6 border-rose-500/20 bg-rose-500/[0.02] space-y-4">
        <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider font-mono flex items-center gap-2">
          <Shield className="w-4 h-4 text-rose-400" /> Administrative Lifecycle & Danger Zone
        </h3>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/80 border border-white/10">
          <div>
            <h4 className="text-xs font-bold text-white">
              {client.isArchived || client.status === 'archived' ? 'Restore Client Workspace' : 'Archive Client Workspace'}
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Archiving hides this workspace from active clients lists while maintaining historical invoices & files.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleArchive}
            leftIcon={
              client.isArchived || client.status === 'archived' ? (
                <RotateCcw className="w-3.5 h-3.5" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )
            }
          >
            {client.isArchived || client.status === 'archived' ? 'Restore Workspace' : 'Archive Workspace'}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <div>
            <h4 className="text-xs font-bold text-rose-300">Permanently Delete Workspace</h4>
            <p className="text-[11px] text-rose-400/80 mt-0.5">
              Permanently removes all associated projects, deliverables, documents, and billing history.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={handleDelete} leftIcon={<Trash2 className="w-3.5 h-3.5" />}>
            Delete Workspace
          </Button>
        </div>
      </Card>
    </div>
  );
};
