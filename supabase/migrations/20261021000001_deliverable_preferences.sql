-- Migration: Add default_deliverable_niche to public.user_settings
-- Created for FlowDesk two-option deliverable niche configuration and persistence

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS default_deliverable_niche TEXT DEFAULT 'software_development';
