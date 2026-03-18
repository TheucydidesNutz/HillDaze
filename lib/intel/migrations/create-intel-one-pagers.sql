-- One-Pagers: single-page advocacy briefing documents
CREATE TABLE intel_one_pagers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES intel_organizations(id) ON DELETE CASCADE,
  title           text NOT NULL,
  topic           text NOT NULL,
  audience        text NOT NULL DEFAULT 'general',
  content         jsonb NOT NULL DEFAULT '{}'::jsonb,
  markdown_draft  text,
  docx_storage_path text,
  status          text NOT NULL DEFAULT 'draft',
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intel_one_pagers_org ON intel_one_pagers(org_id, created_at DESC);
ALTER TABLE intel_one_pagers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view one-pagers"
  ON intel_one_pagers FOR SELECT
  USING (intel_user_is_member(org_id));

CREATE POLICY "Users can create one-pagers"
  ON intel_one_pagers FOR INSERT
  WITH CHECK (intel_user_has_role(org_id, ARRAY['super_admin', 'admin', 'user']::intel_member_role[]));

CREATE POLICY "Users can update one-pagers"
  ON intel_one_pagers FOR UPDATE
  USING (intel_user_has_role(org_id, ARRAY['super_admin', 'admin', 'user']::intel_member_role[]));

CREATE POLICY "Admins can delete one-pagers"
  ON intel_one_pagers FOR DELETE
  USING (intel_user_has_role(org_id, ARRAY['super_admin', 'admin']::intel_member_role[]));
