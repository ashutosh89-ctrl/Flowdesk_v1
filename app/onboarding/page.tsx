'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/backend/utilities/supabase';
import { ProfileService } from '@/backend/auth/profile-service';
import { Button } from '@/frontend/shared/ui/button';
import { Input } from '@/frontend/shared/ui/input';
import { ToastProvider, useToast } from '@/frontend/shared/ui/toast';
import { AuthProvider, useAuth } from '@/frontend/auth/auth-context';
import { User, Building, ArrowRight, Sparkles, Loader2 } from 'lucide-react';

function OnboardingContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const { refreshProfile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    async function initUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || '');

      const metaName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      const metaBiz = user.user_metadata?.business_name || '';

      if (metaName) setFullName(metaName);
      if (metaBiz) setBusinessName(metaBiz);

      setCheckingAuth(false);
    }

    initUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const finalUserId = user?.id || userId;
      const finalEmail = user?.email || userEmail;

      // 1. Save profile via ProfileService (handles both Supabase DB & local state)
      await ProfileService.upsertProfile(finalUserId, {
        id: finalUserId,
        name: fullName || 'User',
        companyName: businessName || 'My Workspace',
        email: finalEmail,
        onboardingCompleted: true,
      });

      // 2. Direct Supabase tables upsert (idempotent — no duplicate workspace)
      try {
        await supabase.from('profiles').upsert(
          {
            id: finalUserId,
            full_name: fullName,
            business_name: businessName || 'My Workspace',
            email: finalEmail,
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        // DUPLICATE-WORKSPACE PREVENTION: a workspace may already exist —
        // getCurrentWorkspace() auto-creates one lazily for authenticated users.
        // Check first, insert only if the user owns none. The app-layer guard is
        // paired with a partial unique index migration (phase28_workspace_unique).
        const { data: existingWorkspaces } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', finalUserId)
          .limit(1);

        if (!existingWorkspaces || existingWorkspaces.length === 0) {
          const { error: wsError } = await supabase.from('workspaces').insert({
            owner_id: finalUserId,
            name: businessName || 'My Workspace',
          });
          if (wsError) {
            // Unique-index race with a concurrent creation: a workspace now
            // exists — that satisfies the goal, so this is not an error state.
            console.warn('Workspace creation notice:', wsError.message);
          }
        }
      } catch (dbErr: any) {
        console.warn('Database table insert notice (continuing with session profile):', dbErr?.message);
      }

      await refreshProfile();
      showToast('Onboarding Complete', 'Your workspace is ready.', 'success');

      // 3. Launch into Dashboard
      router.replace('/dashboard');
    } catch (err: any) {
      console.error('Onboarding exception:', err);
      showToast('Notice', 'Completing setup...', 'info');
      router.replace('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#101312] text-[#F5F5F0] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#43D6B0]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101312] text-[#F5F5F0] flex flex-col items-center justify-center p-4 selection:bg-[#43D6B0] selection:text-[#101312] relative overflow-hidden">
      {/* Subtle ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 bg-[#176B5B]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-[#176B5B]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-md w-full p-8 rounded-3xl bg-[#191F1D] border border-[#176B5B]/30 shadow-2xl backdrop-blur-xl space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#176B5B]/20 border border-[#176B5B]/35 flex items-center justify-center mx-auto text-[#43D6B0]">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#F5F5F0]">Welcome to FlowDesk</h1>
          <p className="text-xs text-[#A6B4AE]">Complete your profile and initialize your workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            required
          />

          <Input
            label="Business / Workspace Name"
            type="text"
            placeholder="My Workspace"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            leftIcon={<Building className="w-4 h-4" />}
            required
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 text-sm font-semibold"
            isLoading={loading}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Create Workspace & Launch
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <ToastProvider>
      <AuthProvider>
        <OnboardingContent />
      </AuthProvider>
    </ToastProvider>
  );
}
