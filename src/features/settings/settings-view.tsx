import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { SettingsService } from '../../services';
import { UserProfile } from '../../types';
import { User, Settings, DollarSign, Bell, Shield, Save } from 'lucide-react';
import { useToast } from '../../components/ui/toast';

export const SettingsView: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    SettingsService.getUserProfile().then(setProfile);
  }, []);

  if (!profile) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    SettingsService.updateUserProfile(profile).then(() => {
      setLoading(false);
      showToast('Settings Saved', 'Profile & rates updated successfully.', 'success');
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="pb-6 border-b border-white/10">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">OS Preferences & Rates</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Configure studio profile, hourly rate defaults, and notifications.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Settings */}
        <Card variant="crystal">
          <CardHeader>
            <CardTitle>Studio Profile</CardTitle>
            <CardDescription>Public information displayed on client portals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                required
              />
              <Input
                label="Professional Title"
                value={profile.title}
                onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Email Address"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                required
              />
              <Input
                label="Company / Studio Name"
                value={profile.companyName}
                onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Rates & Invoicing Defaults */}
        <Card variant="crystal">
          <CardHeader>
            <CardTitle>Rates & Currency Defaults</CardTitle>
            <CardDescription>Default calculations for new projects and invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Hourly Rate ($)"
                type="number"
                value={profile.hourlyRate}
                onChange={(e) => setProfile({ ...profile, hourlyRate: parseFloat(e.target.value) || 0 })}
                required
              />
              <Input
                label="Primary Currency"
                value={profile.currency}
                onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
                required
              />
              <Input
                label="Default Tax Rate (%)"
                type="number"
                value={profile.taxRate}
                onChange={(e) => setProfile({ ...profile, taxRate: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card variant="crystal">
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Manage real-time activity notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10">
              <div>
                <h4 className="text-sm font-semibold text-white">Deliverable Approval Alerts</h4>
                <p className="text-xs text-zinc-400">Receive instant toasts when clients sign off work.</p>
              </div>
              <input
                type="checkbox"
                checked={profile.notificationsEnabled}
                onChange={(e) => setProfile({ ...profile, notificationsEnabled: e.target.checked })}
                className="w-5 h-5 accent-white cursor-pointer"
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Action Bar */}
        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={loading}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Preferences
          </Button>
        </div>
      </form>
    </div>
  );
};
