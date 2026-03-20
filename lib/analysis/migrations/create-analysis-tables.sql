-- Covaled Analysis: Person Profiling & Communication Intelligence
-- Migration: Create all analysis tables
-- =============================================================================

-- =============================================================================
-- 1. analysis_profiles
-- =============================================================================
CREATE TABLE analysis_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES intel_organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  title text,
  position_type text NOT NULL CHECK (position_type IN ('congress_member','jurist','executive','regulator','other')),
  party text,
  state text,
  district text,
  court text,
  organization text,
  aliases text[] DEFAULT '{}',
  baseline_attributes jsonb DEFAULT '{}',
  profile_type text NOT NULL CHECK (profile_type IN ('primary','staffer')) DEFAULT 'primary',
  parent_profile_id uuid REFERENCES analysis_profiles(id) ON DELETE SET NULL,
  research_status text NOT NULL CHECK (research_status IN ('pending','in_progress','complete','error')) DEFAULT 'pending',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analysis_profiles_org ON analysis_profiles(org_id);
CREATE INDEX idx_analysis_profiles_parent ON analysis_profiles(parent_profile_id) WHERE parent_profile_id IS NOT NULL;

-- =============================================================================
-- 2. analysis_data_items (the data lake)
-- =============================================================================
CREATE TABLE analysis_data_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES analysis_profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES intel_organizations(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('speech','vote','bill','legal_filing','donation','social_media','podcast','news','position','uploaded_doc')),
  subcategory text,
  title text,
  full_text text,
  summary text,
  key_quotes text[] DEFAULT '{}',
  key_topics text[] DEFAULT '{}',
  source_url text,
  source_name text,
  source_trust_level text NOT NULL CHECK (source_trust_level IN ('trusted','default','ignored')) DEFAULT 'default',
  item_date date,
  venue text,
  context text,
  tone_analysis jsonb DEFAULT '{}',
  folder_path text,
  storage_path text,
  storage_tier text CHECK (storage_tier IN ('deep_dive','reference')),
  original_filename text,
  file_size_bytes bigint,
  verification_status text NOT NULL CHECK (verification_status IN ('verified','unverified','rejected')) DEFAULT 'verified',
  anomaly_flags jsonb DEFAULT '{}',
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analysis_data_items_profile ON analysis_data_items(profile_id);
CREATE INDEX idx_analysis_data_items_org ON analysis_data_items(org_id);
CREATE INDEX idx_analysis_data_items_category ON analysis_data_items(category);
CREATE INDEX idx_analysis_data_items_verification ON analysis_data_items(verification_status);
CREATE INDEX idx_analysis_data_items_date ON analysis_data_items(item_date DESC);
CREATE INDEX idx_analysis_data_items_topics ON analysis_data_items USING gin(key_topics);
CREATE INDEX idx_analysis_data_items_title_trgm ON analysis_data_items USING gist(title gist_trgm_ops);

-- =============================================================================
-- 3. analysis_soul_documents (one per profile)
-- =============================================================================
CREATE TABLE analysis_soul_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES analysis_profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES intel_organizations(id) ON DELETE CASCADE,
  content jsonb NOT NULL DEFAULT '{}',
  version int NOT NULL DEFAULT 1,
  last_regenerated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. analysis_soul_document_proposals
-- =============================================================================
CREATE TABLE analysis_soul_document_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soul_document_id uuid NOT NULL REFERENCES analysis_soul_documents(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES intel_organizations(id) ON DELETE CASCADE,
  proposed_changes jsonb NOT NULL,
  reasoning text,
  source_data_item_ids uuid[],
  status text NOT NULL CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 5. analysis_source_registry
-- =============================================================================
CREATE TABLE analysis_source_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES intel_organizations(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  source_url text,
  category text CHECK (category IN ('government','news','legal','social','custom')),
  trust_level text NOT NULL CHECK (trust_level IN ('trusted','default','ignored')) DEFAULT 'default',
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 6. analysis_focused_folders
-- =============================================================================
CREATE TABLE analysis_focused_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES analysis_profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES intel_organizations(id) ON DELETE CASCADE,
  folder_type text NOT NULL CHECK (folder_type IN ('input','output')),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 7. analysis_focused_folder_items
-- =============================================================================
CREATE TABLE analysis_focused_folder_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES analysis_focused_folders(id) ON DELETE CASCADE,
  data_item_id uuid REFERENCES analysis_data_items(id) ON DELETE CASCADE,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 8. analysis_conversations
-- =============================================================================
CREATE TABLE analysis_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES analysis_profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES intel_organizations(id) ON DELETE CASCADE,
  title text DEFAULT 'New Conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 9. analysis_messages
-- =============================================================================
CREATE TABLE analysis_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES analysis_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  citations jsonb DEFAULT '[]',
  focused_input_folder_id uuid REFERENCES analysis_focused_folders(id) ON DELETE SET NULL,
  focused_output_folder_id uuid REFERENCES analysis_focused_folders(id) ON DELETE SET NULL,
  model_used text,
  token_count int,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 10. analysis_monitoring_configs (one per profile)
-- =============================================================================
CREATE TABLE analysis_monitoring_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES analysis_profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES intel_organizations(id) ON DELETE CASCADE,
  frequency text NOT NULL CHECK (frequency IN ('every_6_hours','daily','weekly')) DEFAULT 'daily',
  search_queries jsonb DEFAULT '[]',
  last_run_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- 11. analysis_folder_analyses
-- =============================================================================
CREATE TABLE analysis_folder_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES analysis_profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES intel_organizations(id) ON DELETE CASCADE,
  folder_path text NOT NULL,
  analysis jsonb NOT NULL DEFAULT '{}',
  item_count int DEFAULT 0,
  last_regenerated_at timestamptz
);

-- =============================================================================
-- 12. analysis_worker_logs
-- =============================================================================
CREATE TABLE analysis_worker_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name text NOT NULL,
  profile_id uuid REFERENCES analysis_profiles(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('started','running','completed','error')),
  message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Row Level Security
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE analysis_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_data_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_soul_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_soul_document_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_source_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_focused_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_focused_folder_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_monitoring_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_folder_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_worker_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- analysis_profiles policies
-- ---------------------------------------------------------------------------
CREATE POLICY "analysis_profiles_select" ON analysis_profiles
  FOR SELECT USING (intel_user_is_member(org_id));

CREATE POLICY "analysis_profiles_insert" ON analysis_profiles
  FOR INSERT WITH CHECK (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_profiles_update" ON analysis_profiles
  FOR UPDATE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_profiles_delete" ON analysis_profiles
  FOR DELETE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin']::intel_member_role[]));

-- ---------------------------------------------------------------------------
-- analysis_data_items policies
-- ---------------------------------------------------------------------------
CREATE POLICY "analysis_data_items_select" ON analysis_data_items
  FOR SELECT USING (intel_user_is_member(org_id));

CREATE POLICY "analysis_data_items_insert" ON analysis_data_items
  FOR INSERT WITH CHECK (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_data_items_update" ON analysis_data_items
  FOR UPDATE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_data_items_delete" ON analysis_data_items
  FOR DELETE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin']::intel_member_role[]));

-- ---------------------------------------------------------------------------
-- analysis_soul_documents policies
-- ---------------------------------------------------------------------------
CREATE POLICY "analysis_soul_documents_select" ON analysis_soul_documents
  FOR SELECT USING (intel_user_is_member(org_id));

CREATE POLICY "analysis_soul_documents_insert" ON analysis_soul_documents
  FOR INSERT WITH CHECK (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_soul_documents_update" ON analysis_soul_documents
  FOR UPDATE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_soul_documents_delete" ON analysis_soul_documents
  FOR DELETE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin']::intel_member_role[]));

-- ---------------------------------------------------------------------------
-- analysis_soul_document_proposals policies
-- ---------------------------------------------------------------------------
CREATE POLICY "analysis_soul_document_proposals_select" ON analysis_soul_document_proposals
  FOR SELECT USING (intel_user_is_member(org_id));

CREATE POLICY "analysis_soul_document_proposals_insert" ON analysis_soul_document_proposals
  FOR INSERT WITH CHECK (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_soul_document_proposals_update" ON analysis_soul_document_proposals
  FOR UPDATE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_soul_document_proposals_delete" ON analysis_soul_document_proposals
  FOR DELETE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin']::intel_member_role[]));

-- ---------------------------------------------------------------------------
-- analysis_source_registry policies
-- ---------------------------------------------------------------------------
CREATE POLICY "analysis_source_registry_select" ON analysis_source_registry
  FOR SELECT USING (intel_user_is_member(org_id));

CREATE POLICY "analysis_source_registry_insert" ON analysis_source_registry
  FOR INSERT WITH CHECK (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_source_registry_update" ON analysis_source_registry
  FOR UPDATE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_source_registry_delete" ON analysis_source_registry
  FOR DELETE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin']::intel_member_role[]));

-- ---------------------------------------------------------------------------
-- analysis_focused_folders policies
-- ---------------------------------------------------------------------------
CREATE POLICY "analysis_focused_folders_select" ON analysis_focused_folders
  FOR SELECT USING (intel_user_is_member(org_id));

CREATE POLICY "analysis_focused_folders_insert" ON analysis_focused_folders
  FOR INSERT WITH CHECK (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_focused_folders_update" ON analysis_focused_folders
  FOR UPDATE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_focused_folders_delete" ON analysis_focused_folders
  FOR DELETE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin']::intel_member_role[]));

-- ---------------------------------------------------------------------------
-- analysis_focused_folder_items policies (join through parent)
-- ---------------------------------------------------------------------------
CREATE POLICY "analysis_focused_folder_items_select" ON analysis_focused_folder_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM analysis_focused_folders f WHERE f.id = folder_id AND intel_user_is_member(f.org_id))
  );

CREATE POLICY "analysis_focused_folder_items_insert" ON analysis_focused_folder_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM analysis_focused_folders f WHERE f.id = folder_id AND intel_user_has_role(f.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "analysis_focused_folder_items_update" ON analysis_focused_folder_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM analysis_focused_folders f WHERE f.id = folder_id AND intel_user_has_role(f.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "analysis_focused_folder_items_delete" ON analysis_focused_folder_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM analysis_focused_folders f WHERE f.id = folder_id AND intel_user_has_role(f.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

-- ---------------------------------------------------------------------------
-- analysis_conversations policies
-- ---------------------------------------------------------------------------
CREATE POLICY "analysis_conversations_select" ON analysis_conversations
  FOR SELECT USING (intel_user_is_member(org_id));

CREATE POLICY "analysis_conversations_insert" ON analysis_conversations
  FOR INSERT WITH CHECK (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_conversations_update" ON analysis_conversations
  FOR UPDATE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_conversations_delete" ON analysis_conversations
  FOR DELETE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin']::intel_member_role[]));

-- ---------------------------------------------------------------------------
-- analysis_messages policies (join through parent)
-- ---------------------------------------------------------------------------
CREATE POLICY "analysis_messages_select" ON analysis_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM analysis_conversations c WHERE c.id = conversation_id AND intel_user_is_member(c.org_id))
  );

CREATE POLICY "analysis_messages_insert" ON analysis_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM analysis_conversations c WHERE c.id = conversation_id AND intel_user_has_role(c.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "analysis_messages_update" ON analysis_messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM analysis_conversations c WHERE c.id = conversation_id AND intel_user_has_role(c.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "analysis_messages_delete" ON analysis_messages
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM analysis_conversations c WHERE c.id = conversation_id AND intel_user_has_role(c.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

-- ---------------------------------------------------------------------------
-- analysis_monitoring_configs policies
-- ---------------------------------------------------------------------------
CREATE POLICY "analysis_monitoring_configs_select" ON analysis_monitoring_configs
  FOR SELECT USING (intel_user_is_member(org_id));

CREATE POLICY "analysis_monitoring_configs_insert" ON analysis_monitoring_configs
  FOR INSERT WITH CHECK (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_monitoring_configs_update" ON analysis_monitoring_configs
  FOR UPDATE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_monitoring_configs_delete" ON analysis_monitoring_configs
  FOR DELETE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin']::intel_member_role[]));

-- ---------------------------------------------------------------------------
-- analysis_folder_analyses policies
-- ---------------------------------------------------------------------------
CREATE POLICY "analysis_folder_analyses_select" ON analysis_folder_analyses
  FOR SELECT USING (intel_user_is_member(org_id));

CREATE POLICY "analysis_folder_analyses_insert" ON analysis_folder_analyses
  FOR INSERT WITH CHECK (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_folder_analyses_update" ON analysis_folder_analyses
  FOR UPDATE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "analysis_folder_analyses_delete" ON analysis_folder_analyses
  FOR DELETE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin']::intel_member_role[]));

-- ---------------------------------------------------------------------------
-- analysis_worker_logs policies
-- Note: worker_logs may not always have an org_id context; uses profile join
-- ---------------------------------------------------------------------------
CREATE POLICY "analysis_worker_logs_select" ON analysis_worker_logs
  FOR SELECT USING (
    profile_id IS NULL
    OR EXISTS (SELECT 1 FROM analysis_profiles p WHERE p.id = profile_id AND intel_user_is_member(p.org_id))
  );

CREATE POLICY "analysis_worker_logs_insert" ON analysis_worker_logs
  FOR INSERT WITH CHECK (
    profile_id IS NULL
    OR EXISTS (SELECT 1 FROM analysis_profiles p WHERE p.id = profile_id AND intel_user_has_role(p.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "analysis_worker_logs_update" ON analysis_worker_logs
  FOR UPDATE USING (
    profile_id IS NULL
    OR EXISTS (SELECT 1 FROM analysis_profiles p WHERE p.id = profile_id AND intel_user_has_role(p.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "analysis_worker_logs_delete" ON analysis_worker_logs
  FOR DELETE USING (
    profile_id IS NULL
    OR EXISTS (SELECT 1 FROM analysis_profiles p WHERE p.id = profile_id AND intel_user_has_role(p.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

-- =============================================================================
-- updated_at trigger function & triggers
-- =============================================================================
CREATE OR REPLACE FUNCTION analysis_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON analysis_profiles
  FOR EACH ROW EXECUTE FUNCTION analysis_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON analysis_data_items
  FOR EACH ROW EXECUTE FUNCTION analysis_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON analysis_soul_documents
  FOR EACH ROW EXECUTE FUNCTION analysis_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON analysis_focused_folders
  FOR EACH ROW EXECUTE FUNCTION analysis_set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON analysis_conversations
  FOR EACH ROW EXECUTE FUNCTION analysis_set_updated_at();

-- =============================================================================
-- Default sources seed table
-- =============================================================================
CREATE TABLE analysis_default_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_url text NOT NULL,
  category text NOT NULL CHECK (category IN ('government','news','legal','social','custom')),
  trust_level text NOT NULL CHECK (trust_level IN ('trusted','default','ignored')) DEFAULT 'default'
);

-- Seed the default sources
INSERT INTO analysis_default_sources (source_name, source_url, category, trust_level) VALUES
  -- Trusted sources
  ('Congress.gov',       'congress.gov',         'government', 'trusted'),
  ('C-SPAN',             'c-span.org',           'government', 'trusted'),
  ('Supreme Court',      'supremecourt.gov',     'legal',      'trusted'),
  ('CourtListener',      'courtlistener.com',    'legal',      'trusted'),
  ('OpenSecrets',        'opensecrets.org',      'government', 'trusted'),
  ('VoteSmart',          'votesmart.org',        'government', 'trusted'),
  ('Federal Register',   'federalregister.gov',  'government', 'trusted'),
  ('Regulations.gov',    'regulations.gov',      'government', 'trusted'),
  ('FEC',                'fec.gov',              'government', 'trusted'),
  ('AP News',            'apnews.com',           'news',       'trusted'),
  ('Reuters',            'reuters.com',          'news',       'trusted'),
  -- Default sources
  ('Internet Archive',       'archive.org',          'social',     'default'),
  ('Google Scholar Legal',   'scholar.google.com',   'legal',      'default'),
  ('OnTheIssues',            'ontheissues.org',      'government', 'default'),
  ('GovTrack',               'govtrack.us',          'government', 'default'),
  ('PACER',                  'pacer.uscourts.gov',   'legal',      'default');

-- =============================================================================
-- Seed function: copy default sources into an org's source registry
-- =============================================================================
CREATE OR REPLACE FUNCTION seed_analysis_org_sources(p_org_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO analysis_source_registry (org_id, source_name, source_url, category, trust_level, is_default)
  SELECT
    p_org_id,
    ds.source_name,
    ds.source_url,
    ds.category,
    ds.trust_level,
    true
  FROM analysis_default_sources ds
  WHERE NOT EXISTS (
    SELECT 1
    FROM analysis_source_registry sr
    WHERE sr.org_id = p_org_id
      AND sr.source_url = ds.source_url
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
