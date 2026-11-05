-- FlowDesk Core Feature Completion Migration
-- Adds Task Management, Client Onboarding Questionnaires, and Digital Contracts & Signatures

-- 1. TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'blocked')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON public.tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners can manage tasks"
  ON public.tasks
  FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

-- 2. QUESTIONNAIRES TABLE
CREATE TABLE IF NOT EXISTS public.questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'submitted', 'reviewed')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questionnaires_workspace_id ON public.questionnaires(workspace_id);
CREATE INDEX IF NOT EXISTS idx_questionnaires_client_id ON public.questionnaires(client_id);

ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners can manage questionnaires"
  ON public.questionnaires
  FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view and submit assigned questionnaires"
  ON public.questionnaires
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- 3. CONTRACTS TABLE
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  terms TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'declined')),
  signed_at TIMESTAMPTZ,
  signed_by_name TEXT,
  signature_data_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contracts_workspace_id ON public.contracts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON public.contracts(client_id);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace owners can manage contracts"
  ON public.contracts
  FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view and sign assigned contracts"
  ON public.contracts
  FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

