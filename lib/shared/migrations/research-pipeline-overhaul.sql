-- Research Pipeline Overhaul — schema additions
-- Run against Supabase: fferiutafqvcomnwvmal.supabase.co

-- /analysis: cache bioguide IDs and other external identifiers
ALTER TABLE analysis_profiles ADD COLUMN IF NOT EXISTS external_ids jsonb DEFAULT '{}';

-- /analysis: store research depth report
ALTER TABLE analysis_profiles ADD COLUMN IF NOT EXISTS research_report jsonb;
ALTER TABLE analysis_profiles ADD COLUMN IF NOT EXISTS last_research_at timestamptz;

-- /intel: store ingestion depth report
ALTER TABLE intel_orgs ADD COLUMN IF NOT EXISTS last_ingestion_report jsonb;
ALTER TABLE intel_orgs ADD COLUMN IF NOT EXISTS last_ingestion_at timestamptz;
