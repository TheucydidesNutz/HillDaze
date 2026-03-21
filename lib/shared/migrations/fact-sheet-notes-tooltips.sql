-- Fact Sheet + Notes migration
-- Run against Supabase: fferiutafqvcomnwvmal.supabase.co

-- Fact sheet on profiles
ALTER TABLE analysis_profiles ADD COLUMN IF NOT EXISTS fact_sheet jsonb;
ALTER TABLE analysis_profiles ADD COLUMN IF NOT EXISTS fact_sheet_generated_at timestamptz;

-- User notes per profile
CREATE TABLE IF NOT EXISTS analysis_profile_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES analysis_profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_profile_notes_profile ON analysis_profile_notes(profile_id, created_at DESC);
