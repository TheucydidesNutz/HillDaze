import { supabaseAdmin } from '@/lib/supabase';
import { generateEmbedding } from './embeddings';

export interface SearchResult {
  id: string;
  document_id: string;
  chunk_text: string;
  chunk_index: number;
  similarity: number;
  document_title: string;
}

export async function searchWorkspaceChunks(
  workspaceId: string,
  query: string,
  options?: { matchCount?: number; threshold?: number }
): Promise<SearchResult[]> {
  const matchCount = options?.matchCount ?? 15;
  const threshold = options?.threshold ?? 0.3;

  const queryEmbedding = await generateEmbedding(query);

  const { data: chunks, error } = await supabaseAdmin.rpc('match_workspace_chunks', {
    p_workspace_id: workspaceId,
    p_embedding: JSON.stringify(queryEmbedding),
    p_match_count: matchCount,
    p_match_threshold: threshold,
  });

  if (error) {
    console.error('[searchWorkspaceChunks] error:', error.message);
    return [];
  }

  if (!chunks || chunks.length === 0) return [];

  // Get document titles for the matched chunks
  const docIds = [...new Set(chunks.map((c: { document_id: string }) => c.document_id))];
  const { data: docs } = await supabaseAdmin
    .from('workspace_documents')
    .select('id, title')
    .in('id', docIds);

  const docTitleMap = new Map((docs || []).map(d => [d.id, d.title]));

  return chunks.map((chunk: { id: string; document_id: string; chunk_text: string; chunk_index: number; similarity: number }) => ({
    id: chunk.id,
    document_id: chunk.document_id,
    chunk_text: chunk.chunk_text,
    chunk_index: chunk.chunk_index,
    similarity: chunk.similarity,
    document_title: docTitleMap.get(chunk.document_id) || 'Untitled',
  }));
}
