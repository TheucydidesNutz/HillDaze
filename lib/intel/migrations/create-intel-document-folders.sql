-- Document folders: nested folder structure for organizing documents
CREATE TABLE intel_document_folders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES intel_organizations(id) ON DELETE CASCADE,
  parent_id       uuid REFERENCES intel_document_folders(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text NOT NULL,
  folder_type     text NOT NULL DEFAULT 'custom',  -- 'deep_dive', 'reference', 'custom'
  description     text,
  sort_order      int NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, parent_id, slug)
);

CREATE INDEX idx_intel_doc_folders_org ON intel_document_folders(org_id, parent_id);

ALTER TABLE intel_document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view folders"
  ON intel_document_folders FOR SELECT
  USING (intel_user_is_member(org_id));
CREATE POLICY "Users can create folders"
  ON intel_document_folders FOR INSERT
  WITH CHECK (intel_user_has_role(org_id, ARRAY['super_admin', 'admin', 'user']::intel_member_role[]));
CREATE POLICY "Admins can update folders"
  ON intel_document_folders FOR UPDATE
  USING (intel_user_has_role(org_id, ARRAY['super_admin', 'admin']::intel_member_role[]));
CREATE POLICY "Admins can delete folders"
  ON intel_document_folders FOR DELETE
  USING (intel_user_has_role(org_id, ARRAY['super_admin', 'admin']::intel_member_role[]));

-- Add folder_id to documents table
ALTER TABLE intel_documents ADD COLUMN folder_id uuid REFERENCES intel_document_folders(id) ON DELETE SET NULL;
CREATE INDEX idx_intel_documents_folder ON intel_documents(folder_id);

-- Migration: create default folders for existing orgs and link documents
DO $$
DECLARE
  org RECORD;
  dd_id uuid;
  ref_id uuid;
BEGIN
  FOR org IN SELECT id FROM intel_organizations LOOP
    -- Create Deep Dive folder
    INSERT INTO intel_document_folders (org_id, name, slug, folder_type, description, sort_order)
    VALUES (
      org.id,
      'Deep Dive',
      'deep-dive',
      'deep_dive',
      'Full analytical documents the Intelligence Analyst can read in their entirety. Upload legislation, regulations, academic papers, industry reports, and detailed policy analyses.',
      0
    )
    RETURNING id INTO dd_id;

    -- Create Reference folder
    INSERT INTO intel_document_folders (org_id, name, slug, folder_type, description, sort_order)
    VALUES (
      org.id,
      'Reference',
      'reference',
      'reference',
      'Tone and style reference materials. Upload past op-eds, position papers, testimony transcripts, and writing samples. The AI reads these for voice and framing, not detailed analysis.',
      1
    )
    RETURNING id INTO ref_id;

    -- Migrate existing documents
    UPDATE intel_documents SET folder_id = dd_id WHERE org_id = org.id AND folder = 'deep_dive';
    UPDATE intel_documents SET folder_id = ref_id WHERE org_id = org.id AND folder = 'reference';
  END LOOP;
END $$;
