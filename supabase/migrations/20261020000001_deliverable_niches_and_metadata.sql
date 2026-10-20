-- Migration: 20261020000001_deliverable_niches_and_metadata.sql
-- Description: Adds niche categorization and typed JSONB metadata support to deliverables table.

ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS niche TEXT DEFAULT 'general';
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Index for querying deliverables by niche within workspace
CREATE INDEX IF NOT EXISTS idx_deliverables_niche ON public.deliverables(workspace_id, niche);
