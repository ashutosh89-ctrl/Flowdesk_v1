'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { PortalProfile } from '../../../types';
import { Building2, User, Mail, Phone, Globe, ShieldCheck, Clock, Languages } from 'lucide-react';

interface ProfilePanelProps {
  profile: PortalProfile;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ profile }) => {
  return (
    <div className="space-y-6 font-sans max-w-3xl">
      <div className="pb-2 border-b border-white/10">
        <h2 className="text-lg font-bold text-white tracking-tight">Client Account & Profile</h2>
        <p className="text-xs text-zinc-400">View contact records and workspace preferences</p>
      </div>

      <Card variant="crystal" className="p-6 border-white/15 space-y-6">
        {/* Header Profile Summary */}
        <div className="flex items-center gap-4 pb-6 border-b border-white/10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white to-zinc-300 text-zinc-950 font-extrabold text-xl flex items-center justify-center shadow-lg">
            {profile.company ? profile.company.charAt(0) : 'C'}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{profile.company}</h3>
            <p className="text-xs text-zinc-400">Primary Contact: {profile.contactPerson}</p>
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
              <ShieldCheck className="w-3 h-3" />
              Verified Enterprise Account
            </span>
          </div>
        </div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-400" />
              Company Organization
            </span>
            <p className="text-sm font-bold text-white">{profile.company}</p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-zinc-400" />
              Contact Person
            </span>
            <p className="text-sm font-bold text-white">{profile.contactPerson}</p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-zinc-400" />
              Primary Email
            </span>
            <p className="text-xs font-mono font-bold text-white">{profile.email}</p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-zinc-400" />
              Direct Phone Number
            </span>
            <p className="text-xs font-mono font-bold text-white">{profile.phone || 'Not provided'}</p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-zinc-400" />
              Workspace Timezone
            </span>
            <p className="text-xs font-mono font-bold text-white">{profile.timezone}</p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-zinc-400" />
              Portal Language
            </span>
            <p className="text-xs font-mono font-bold text-white">{profile.portalLanguage || 'English (US)'}</p>
          </div>
        </div>

        {/* Security & Access Audit */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-400">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Recent Portal Access</span>
          </div>
          <span className="text-white font-bold">{profile.recentAccess || 'Just now'}</span>
        </div>
      </Card>
    </div>
  );
};
