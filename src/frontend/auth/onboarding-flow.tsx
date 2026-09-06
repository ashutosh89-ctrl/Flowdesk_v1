import React, { useState } from 'react';
import { Input } from '@/frontend/shared/ui/input';
import { Button } from '@/frontend/shared/ui/button';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Building,
  User,
  Globe,
  Clock,
  Receipt,
  Users,
  FolderCheck,
  FileText,
  Briefcase,
  UploadCloud,
} from 'lucide-react';
import { useToast } from '@/frontend/shared/ui/toast';
import { useAuth } from '@/frontend/auth/auth-context';
import { OnboardingData } from '@/shared/types';

export interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { profile, user, completeOnboarding } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  // Step 1: Personal Information
  const [fullName, setFullName] = useState<string>(profile?.name || user?.user_metadata?.full_name || '');
  const [profession, setProfession] = useState<string>(profile?.profession || 'Lead Product Designer');
  const [country, setCountry] = useState<string>(profile?.country || 'United States');
  const [timezone, setTimezone] = useState<string>(profile?.timezone || 'America/New_York');
  const [language, setLanguage] = useState<string>(profile?.language || 'English');

  // Step 2: Business Information
  const [businessName, setBusinessName] = useState<string>(profile?.companyName || user?.user_metadata?.business_name || '');
  const [logoUrl] = useState<string>('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150');
  const [currency, setCurrency] = useState<string>('USD');
  const [taxName, setTaxName] = useState<string>('Sales Tax');
  const [taxRate, setTaxRate] = useState<string>('10');

  // Step 3: First Client
  const [clientName, setClientName] = useState<string>('Sarah Jenkins');
  const [clientCompany, setClientCompany] = useState<string>('Apex Digital Labs');
  const [clientEmail, setClientEmail] = useState<string>('sarah@apexdigital.com');

  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'CA$',
    AUD: 'A$',
    INR: '₹',
  };

  const handleNextStep = () => {
    if (step < 5) {
      setStep(step + 1);
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleFinishOnboarding = async () => {
    setLoading(true);
    const onboardingPayload: OnboardingData = {
      fullName,
      profession,
      country,
      timezone,
      language,
      businessName,
      logoUrl,
      currency,
      taxName,
      taxRate: Number(taxRate) || 10,
      clientName,
      clientCompany,
      clientEmail,
    };

    const success = await completeOnboarding(onboardingPayload);
    setLoading(false);

    if (success) {
      showToast('OS Initialized', 'Identity & Workspace configured successfully.', 'success');
      onComplete();
    } else {
      showToast('Notice', 'Could not save onboarding data. Proceeding to workspace.', 'info');
      onComplete();
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Stepper Indicator */}
      <div className="space-y-2 pb-4 border-b border-white/10">
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span className="text-white font-semibold">STEP {step} OF 5</span>
          <span className="text-zinc-400 uppercase">
            {step === 1 && 'Personal Info'}
            {step === 2 && 'Business Info'}
            {step === 3 && 'First Client'}
            {step === 4 && 'Workspace Preview'}
            {step === 5 && 'Finish & Launch'}
          </span>
        </div>
        <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-white h-full transition-all duration-300 ease-out"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* STEP 1: Personal Information */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-xl font-bold text-white tracking-tight">Personal Information</h3>
            <p className="text-xs text-zinc-400 mt-1">Configure your personal profile details.</p>
          </div>

          <Input
            label="Full Name"
            type="text"
            placeholder="e.g. John Smith"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            required
          />

          <Input
            label="Profession / Expertise"
            type="text"
            placeholder="e.g. Lead Designer, Software Engineer"
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            leftIcon={<Briefcase className="w-4 h-4" />}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Country</label>
              <div className="relative">
                <Globe className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-white/30"
                >
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Canada">Canada</option>
                  <option value="Germany">Germany</option>
                  <option value="France">France</option>
                  <option value="Australia">Australia</option>
                  <option value="India">India</option>
                  <option value="Japan">Japan</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Time Zone</label>
              <div className="relative">
                <Clock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-white/30"
                >
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Preferred Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-white/30"
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Japanese">Japanese</option>
            </select>
          </div>
        </div>
      )}

      {/* STEP 2: Business Information */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-xl font-bold text-white tracking-tight">Business & Tax Details</h3>
            <p className="text-xs text-zinc-400 mt-1">Setup studio branding and default billing terms.</p>
          </div>

          <Input
            label="Business / Studio Name"
            type="text"
            placeholder="Your Studio Name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            leftIcon={<Building className="w-4 h-4" />}
            required
          />

          {/* Logo placeholder */}
          <div className="p-3 rounded-xl border border-dashed border-white/20 bg-white/[0.02] flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
              ) : (
                <UploadCloud className="w-4 h-4 text-zinc-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-white block">Studio Logo Placeholder</span>
              <span className="text-[10px] text-zinc-400 block truncate">Used on invoices & client workspace header</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-400">Default Currency</label>
            <div className="grid grid-cols-3 gap-2">
              {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR'].map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setCurrency(curr)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    currency === curr
                      ? 'bg-white text-zinc-950 border-white shadow-md'
                      : 'bg-zinc-900 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>{curr}</span>
                  <span className="text-[10px] opacity-70">({currencySymbols[curr]})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tax Name"
              type="text"
              placeholder="e.g. Sales Tax, VAT"
              value={taxName}
              onChange={(e) => setTaxName(e.target.value)}
            />

            <Input
              label="Default Tax Rate (%)"
              type="number"
              placeholder="10"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* STEP 3: First Client */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-xl font-bold text-white tracking-tight">Create Your First Client</h3>
            <p className="text-xs text-zinc-400 mt-1">FlowDesk creates a dedicated glass hub for every client.</p>
          </div>

          <Input
            label="Client Contact Name"
            type="text"
            placeholder="Sarah Jenkins"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            required
          />

          <Input
            label="Company / Organization Name"
            type="text"
            placeholder="Apex Digital Labs"
            value={clientCompany}
            onChange={(e) => setClientCompany(e.target.value)}
            leftIcon={<Building className="w-4 h-4" />}
            required
          />

          <Input
            label="Client Email Address"
            type="email"
            placeholder="sarah@apexdigital.com"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            leftIcon={<Users className="w-4 h-4" />}
            required
          />
        </div>
      )}

      {/* STEP 4: Workspace Preview */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-xl font-bold text-white tracking-tight">Workspace Preview</h3>
            <p className="text-xs text-zinc-400 mt-1">Here is how your client hub will automatically initialize.</p>
          </div>

          {/* Mini Interactive Preview Card */}
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center font-bold text-white text-xs">
                  {clientCompany.slice(0, 2).toUpperCase() || 'AP'}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{clientCompany || 'Apex Digital Labs'}</h4>
                  <p className="text-[10px] text-zinc-400">{clientName || 'Sarah Jenkins'} • {clientEmail}</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium">
                Active Client
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-400 text-[10px]">
                  <FolderCheck className="w-3 h-3 text-white" />
                  <span>INITIAL PROJECT</span>
                </div>
                <p className="font-semibold text-white truncate">Q3 Brand Strategy & Design</p>
                <p className="text-[10px] text-zinc-400">{currencySymbols[currency] || '$'}12,500 Budget</p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-400 text-[10px]">
                  <Receipt className="w-3 h-3 text-white" />
                  <span>DRAFT INVOICE</span>
                </div>
                <p className="font-semibold text-white truncate">INV-2026-001</p>
                <p className="text-[10px] text-zinc-400">{currencySymbols[currency] || '$'}2,500 Deposit</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-zinc-300" />
                <span>Master Services Agreement (MSA)</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">Auto-Generated</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Finish & Celebration */}
      {step === 5 && (
        <div className="space-y-4 text-center py-2">
          <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto text-white shadow-xl">
            <Sparkles className="w-7 h-7 text-amber-300" />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-white tracking-tight">FlowDesk OS Configured</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              Your identity, default currency ({currency}), tax rate ({taxRate}%), and first client ({clientCompany}) are ready.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-left space-y-2 text-xs text-zinc-300">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Owner Profile:</span>
              <span className="text-white font-medium">{fullName} ({profession})</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Studio Entity:</span>
              <span className="text-white font-medium">{businessName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">First Client Hub:</span>
              <span className="text-white font-medium">{clientCompany}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Row Level Security:</span>
              <span className="text-emerald-400 font-mono text-[10px]">Active & Enforced</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons Nav */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {step > 1 && step < 5 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handlePrevStep}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
        ) : (
          <div />
        )}

        {step < 5 ? (
          <Button
            type="button"
            variant="primary"
            className="ml-auto"
            onClick={handleNextStep}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            className="w-full"
            isLoading={loading}
            onClick={handleFinishOnboarding}
            rightIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Launch Mission Control
          </Button>
        )}
      </div>
    </div>
  );
};
