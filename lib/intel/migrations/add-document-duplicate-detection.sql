-- Add duplicate detection columns to intel_documents
-- Layer 1: Exact duplicate detection via file hash
ALTER TABLE intel_documents ADD COLUMN IF NOT EXISTS file_hash text;
CREATE INDEX IF NOT EXISTS idx_intel_documents_hash ON intel_documents(org_id, file_hash);

-- Enable pg_trgm extension for Layer 2: near-duplicate detection
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create index to speed up trigram similarity queries on first 500 chars of full_text
-- Note: GiST index on expression for trigram similarity
CREATE INDEX IF NOT EXISTS idx_intel_documents_text_trgm
  ON intel_documents USING gist (left(full_text, 500) gist_trgm_ops)
  WHERE full_text IS NOT NULL;

-- RPC function for near-duplicate detection using pg_trgm
CREATE OR REPLACE FUNCTION check_document_similarity(
  p_org_id uuid,
  p_text_prefix text,
  p_threshold real DEFAULT 0.7
)
RETURNS TABLE(id uuid, filename text, folder_id uuid, similarity real) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.filename,
    d.folder_id,
    similarity(left(d.full_text, 500), p_text_prefix)::real AS similarity
  FROM intel_documents d
  WHERE d.org_id = p_org_id
    AND d.full_text IS NOT NULL
    AND similarity(left(d.full_text, 500), p_text_prefix) > p_threshold
  ORDER BY similarity(left(d.full_text, 500), p_text_prefix) DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql STABLE;
