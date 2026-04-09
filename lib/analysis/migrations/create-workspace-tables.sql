-- Covaled Analysis: Multi-Tenant Workspaces
-- Migration: Create all workspace tables + pgvector extension
-- =============================================================================

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 1. workspaces
-- =============================================================================
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES intel_organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  soul_doc jsonb DEFAULT '{}',
  soul_doc_md text,
  soul_doc_version int NOT NULL DEFAULT 1,
  settings jsonb DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, slug)
);

CREATE INDEX idx_workspaces_org ON workspaces(org_id);

-- =============================================================================
-- 2. workspace_documents
-- =============================================================================
CREATE TABLE workspace_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('upload','web','research_agent','generated')),
  source_url text,
  content text,
  summary text,
  metadata jsonb DEFAULT '{}',
  folder text DEFAULT 'General',
  storage_path text,
  original_filename text,
  file_size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_documents_workspace ON workspace_documents(workspace_id);
CREATE INDEX idx_workspace_documents_folder ON workspace_documents(workspace_id, folder);

-- =============================================================================
-- 3. workspace_chunks (pgvector embeddings)
-- =============================================================================
CREATE TABLE workspace_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES workspace_documents(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  chunk_text text NOT NULL,
  chunk_index int NOT NULL,
  embedding vector(768),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_chunks_workspace ON workspace_chunks(workspace_id);
CREATE INDEX idx_workspace_chunks_document ON workspace_chunks(document_id);
CREATE INDEX idx_workspace_chunks_embedding ON workspace_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- 4. workspace_conversations
-- =============================================================================
CREATE TABLE workspace_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  title text DEFAULT 'New Conversation',
  source text NOT NULL CHECK (source IN ('web','butterrobot','api')) DEFAULT 'web',
  messages jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_conversations_workspace ON workspace_conversations(workspace_id);
CREATE INDEX idx_workspace_conversations_user ON workspace_conversations(workspace_id, user_id);

-- =============================================================================
-- 5. workspace_soul_doc_proposals
-- =============================================================================
CREATE TABLE workspace_soul_doc_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  proposed_changes jsonb NOT NULL,
  description text,
  source text NOT NULL CHECK (source IN ('conversation','research_agent','manual')) DEFAULT 'manual',
  status text NOT NULL CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  proposed_by uuid REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_soul_doc_proposals_workspace ON workspace_soul_doc_proposals(workspace_id);
CREATE INDEX idx_workspace_soul_doc_proposals_status ON workspace_soul_doc_proposals(workspace_id, status);

-- =============================================================================
-- 6. workspace_soul_doc_history
-- =============================================================================
CREATE TABLE workspace_soul_doc_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version int NOT NULL,
  soul_doc jsonb NOT NULL,
  soul_doc_md text,
  changed_by text NOT NULL CHECK (changed_by IN ('user','system','butterrobot')) DEFAULT 'user',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_soul_doc_history ON workspace_soul_doc_history(workspace_id, version DESC);

-- =============================================================================
-- 7. workspace_report_templates
-- =============================================================================
CREATE TABLE workspace_report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  example_reports jsonb DEFAULT '[]',
  output_format text NOT NULL CHECK (output_format IN ('docx','md','pdf')) DEFAULT 'md',
  generation_prompt text,
  schedule text,
  last_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_report_templates_workspace ON workspace_report_templates(workspace_id);

-- =============================================================================
-- 8. workspace_generated_reports
-- =============================================================================
CREATE TABLE workspace_generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES workspace_report_templates(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  generated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_generated_reports_workspace ON workspace_generated_reports(workspace_id);
CREATE INDEX idx_workspace_generated_reports_template ON workspace_generated_reports(template_id);

-- =============================================================================
-- 9. workspace_research_config
-- =============================================================================
CREATE TABLE workspace_research_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  check_interval text NOT NULL DEFAULT '1h',
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_research_config_workspace ON workspace_research_config(workspace_id);

-- =============================================================================
-- 10. workspace_research_items
-- =============================================================================
CREATE TABLE workspace_research_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  research_config_id uuid REFERENCES workspace_research_config(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text,
  source_url text,
  source_type text,
  relevance_score float,
  verification_status text NOT NULL CHECK (verification_status IN ('unreviewed','relevant','ignored')) DEFAULT 'unreviewed',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_research_items_workspace ON workspace_research_items(workspace_id);
CREATE INDEX idx_workspace_research_items_config ON workspace_research_items(research_config_id);
CREATE INDEX idx_workspace_research_items_status ON workspace_research_items(workspace_id, verification_status);

-- =============================================================================
-- 11. workspace_api_keys (for ButterRobot and external integrations)
-- =============================================================================
CREATE TABLE workspace_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_api_keys_workspace ON workspace_api_keys(workspace_id);
CREATE INDEX idx_workspace_api_keys_hash ON workspace_api_keys(key_hash);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_soul_doc_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_soul_doc_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_research_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_research_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_api_keys ENABLE ROW LEVEL SECURITY;

-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
-- workspaces (has org_id directly)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
CREATE POLICY "workspaces_select" ON workspaces
  FOR SELECT USING (intel_user_is_member(org_id));

CREATE POLICY "workspaces_insert" ON workspaces
  FOR INSERT WITH CHECK (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "workspaces_update" ON workspaces
  FOR UPDATE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin','user']::intel_member_role[]));

CREATE POLICY "workspaces_delete" ON workspaces
  FOR DELETE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin']::intel_member_role[]));

-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
-- workspace_documents (join through workspaces)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
CREATE POLICY "workspace_documents_select" ON workspace_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_is_member(w.org_id))
  );

CREATE POLICY "workspace_documents_insert" ON workspace_documents
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_documents_update" ON workspace_documents
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_documents_delete" ON workspace_documents
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
-- workspace_chunks (join through workspaces)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
CREATE POLICY "workspace_chunks_select" ON workspace_chunks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_is_member(w.org_id))
  );

CREATE POLICY "workspace_chunks_insert" ON workspace_chunks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_chunks_update" ON workspace_chunks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_chunks_delete" ON workspace_chunks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
-- workspace_conversations (join through workspaces)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
CREATE POLICY "workspace_conversations_select" ON workspace_conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_is_member(w.org_id))
  );

CREATE POLICY "workspace_conversations_insert" ON workspace_conversations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_conversations_update" ON workspace_conversations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_conversations_delete" ON workspace_conversations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
-- workspace_soul_doc_proposals (join through workspaces)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
CREATE POLICY "workspace_soul_doc_proposals_select" ON workspace_soul_doc_proposals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_is_member(w.org_id))
  );

CREATE POLICY "workspace_soul_doc_proposals_insert" ON workspace_soul_doc_proposals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_soul_doc_proposals_update" ON workspace_soul_doc_proposals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_soul_doc_proposals_delete" ON workspace_soul_doc_proposals
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
-- workspace_soul_doc_history (join through workspaces)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
CREATE POLICY "workspace_soul_doc_history_select" ON workspace_soul_doc_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_is_member(w.org_id))
  );

CREATE POLICY "workspace_soul_doc_history_insert" ON workspace_soul_doc_history
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_soul_doc_history_delete" ON workspace_soul_doc_history
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
-- workspace_report_templates (join through workspaces)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
CREATE POLICY "workspace_report_templates_select" ON workspace_report_templates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_is_member(w.org_id))
  );

CREATE POLICY "workspace_report_templates_insert" ON workspace_report_templates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_report_templates_update" ON workspace_report_templates
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_report_templates_delete" ON workspace_report_templates
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
-- workspace_generated_reports (join through workspaces)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
CREATE POLICY "workspace_generated_reports_select" ON workspace_generated_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_is_member(w.org_id))
  );

CREATE POLICY "workspace_generated_reports_insert" ON workspace_generated_reports
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_generated_reports_delete" ON workspace_generated_reports
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
-- workspace_research_config (join through workspaces)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
CREATE POLICY "workspace_research_config_select" ON workspace_research_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_is_member(w.org_id))
  );

CREATE POLICY "workspace_research_config_insert" ON workspace_research_config
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_research_config_update" ON workspace_research_config
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_research_config_delete" ON workspace_research_config
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
-- workspace_research_items (join through workspaces)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
CREATE POLICY "workspace_research_items_select" ON workspace_research_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_is_member(w.org_id))
  );

CREATE POLICY "workspace_research_items_insert" ON workspace_research_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_research_items_update" ON workspace_research_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin','user']::intel_member_role[]))
  );

CREATE POLICY "workspace_research_items_delete" ON workspace_research_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
-- workspace_api_keys (join through workspaces)
-- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
CREATE POLICY "workspace_api_keys_select" ON workspace_api_keys
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_is_member(w.org_id))
  );

CREATE POLICY "workspace_api_keys_insert" ON workspace_api_keys
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

CREATE POLICY "workspace_api_keys_delete" ON workspace_api_keys
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_id AND intel_user_has_role(w.org_id, ARRAY['super_admin','admin']::intel_member_role[]))
  );

-- =============================================================================
-- Similarity Search Function
-- =============================================================================
CREATE OR REPLACE FUNCTION match_workspace_chunks(
  p_workspace_id uuid,
  p_embedding vector(768),
  p_match_count int DEFAULT 15,
  p_match_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  chunk_index int,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    wc.id,
    wc.document_id,
    wc.chunk_text,
    wc.chunk_index,
    1 - (wc.embedding <=> p_embedding) AS similarity
  FROM workspace_chunks wc
  WHERE wc.workspace_id = p_workspace_id
    AND 1 - (wc.embedding <=> p_embedding) > p_match_threshold
  ORDER BY wc.embedding <=> p_embedding
  LIMIT p_match_count;
$$;
