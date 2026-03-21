-- Analysis jobs table for Mac Mini worker processing
-- Run against Supabase: fferiutafqvcomnwvmal.supabase.co

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES analysis_profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  job_type TEXT NOT NULL,  -- 'research_quick_update', 'research_full_rerun', 'generate_fact_sheet', 'generate_voice'
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'running', 'complete', 'error'
  params jsonb DEFAULT '{}',
  result jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_pending ON analysis_jobs(status, created_at) WHERE status = 'pending';
