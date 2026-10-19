import React, { useState, useEffect } from 'react';
import { Modal } from '@/frontend/shared/ui/modal';
import { Input } from '@/frontend/shared/ui/input';
import { Button } from '@/frontend/shared/ui/button';
import { CountrySelect } from '@/frontend/shared/ui/country-select';
import { PhoneInput } from '@/frontend/shared/ui/phone-input';
import { switchCountryPrefix } from '@/shared/utils/countries';
import { FreelancerClientManagementService as ClientService } from '@/backend/freelancer';
import { useToast } from '@/frontend/shared/ui/toast';
import { useAuth } from '@/frontend/auth/auth-context';
import { Client } from '@/shared/types';
import { Building2, User, Mail, DollarSign, Tag, FileText } from 'lucide-react';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newClient: Client) => void;
}

export const CreateClientModal: React.FC<CreateClientModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { profile, userSettings } = useAuth();
  const studioCurrency = userSettings?.currency || profile?.currency || 'USD';
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('India');
  const [customCurrency, setCustomCurrency] = useState<string | null>(null);
  const currency = customCurrency !== null ? customCurrency : studioCurrency;
  const [notes, setNotes] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [sendInviteNow, setSendInviteNow] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setIndustry('');
    setCountry('India');
    setCustomCurrency(null);
    setNotes('');
    setTagsStr('');
    setSendInviteNow(true);
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !company.trim() || !email.trim()) {
      setError('Contact Name, Company Name, and Email are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
      const newClient = await ClientService.createClient({
        name: name.trim(),
        company: company.trim(),
        email: email.trim(),
        phone: phone.trim(),
        industry: industry.trim() || 'General',
        status: 'active',
        healthBadge: 'healthy',
        activeProjectsCount: 0,
        country,
        currency: currency || studioCurrency,
        notes: notes.trim(),
        tags,
      });

      showToast('Client Workspace Created', `Workspace for "${company.trim()}" is ready.`, 'success');

      if (sendInviteNow && newClient?.id) {
        try {
          const invRes = await fetch(`/api/clients/${encodeURIComponent(newClient.id)}/invitation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientEmail: email.trim(),
              forceNew: true,
              sendEmail: true,
            }),
          });
          const invData = await invRes.json();
          if (invData.emailDispatched) {
            showToast('Invitation Email Dispatched', `Sent onboarding invitation to ${email.trim()}`, 'success');
          } else if (invData.emailDeliveryError) {
            showToast('Workspace Created', `Client ready. Note: Email paused (${invData.emailDeliveryError}).`, 'info');
          }
        } catch (invErr) {
          console.warn('Auto invitation send notice:', invErr);
        }
      }

      resetForm();
      onClose();
      if (onSuccess) {
        onSuccess(newClient);
      }
    } catch (err: any) {
      console.error('Create client error:', err);
      setError(err?.message || 'Failed to create client workspace. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Client Workspace">
      <form onSubmit={handleCreate} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
            {error}
          </div>
        )}

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PhoneInput
            label="Phone"
            value={phone}
            country={country}
            onChange={(newPhone) => setPhone(newPhone)}
          />
          <Input
            label="Industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. Fintech, SaaS, E-commerce"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CountrySelect
            label="Country"
            value={country}
            onChange={(newCountry) => {
              const updatedPhone = switchCountryPrefix(phone, country, newCountry);
              setCountry(newCountry);
              setPhone(updatedPhone);
            }}
          />
          <Input
            label="Currency"
            value={currency}
            onChange={(e) => setCustomCurrency(e.target.value.toUpperCase())}
            placeholder="e.g. INR, USD, EUR"
          />
        </div>

        <Input
          label="Tags (comma separated)"
          placeholder="Enterprise, VIP, Retainer, Web Design"
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
        />

        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/10">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-white">Send Email Invitation Now</span>
            <p className="text-[11px] text-zinc-400">
              Immediately dispatch a one-time onboarding link to {email.trim() || 'the client email'}.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={sendInviteNow}
              onChange={(e) => setSendInviteNow(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-300">Workspace Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal client preferences, background, or SLA requirements..."
            className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-white/30"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Workspace'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
