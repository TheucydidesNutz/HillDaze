-- Org API Keys: per-org API key management for external data sources
-- Shared across /intel, /analysis, and future Covaled branches

CREATE TABLE org_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES intel_organizations(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  api_key text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, service_name)
);

CREATE INDEX idx_org_api_keys_org ON org_api_keys(org_id);

ALTER TABLE org_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_api_keys_select" ON org_api_keys
  FOR SELECT USING (intel_user_is_member(org_id));

CREATE POLICY "org_api_keys_insert" ON org_api_keys
  FOR INSERT WITH CHECK (intel_user_has_role(org_id, ARRAY['super_admin','admin']::intel_member_role[]));

CREATE POLICY "org_api_keys_update" ON org_api_keys
  FOR UPDATE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin']::intel_member_role[]));

CREATE POLICY "org_api_keys_delete" ON org_api_keys
  FOR DELETE USING (intel_user_has_role(org_id, ARRAY['super_admin','admin']::intel_member_role[]));
