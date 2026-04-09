import type { Workspace } from '../types';
import { searchWorkspaceChunks } from '../workspace-rag';

export async function buildWorkspaceChatPrompt(
  workspace: Workspace,
  orgName: string,
  userMessage: string,
): Promise<{ systemPrompt: string; retrievedChunkIds: string[] }> {
  // Layer 1: Base instructions
  const baseInstructions = `You are a research analyst and content specialist for ${orgName}, working within the "${workspace.name}" workspace.
${workspace.description ? `\nWorkspace context: ${workspace.description}` : ''}

CRITICAL RULES:
- Every factual claim MUST cite a specific document using [DOC:document-id:chunk-index] format
- NEVER invent or fabricate information not present in the provided documents
- If you don't have enough data to answer, say so explicitly
- Distinguish between direct quotes from documents and your own analysis/inference
- When synthesizing across multiple documents, cite each source inline
- Always use [DOC:document-id:chunk-index] citations — these will be rendered as clickable references`;

  // Layer 2: Soul document
  const soulSection = workspace.soul_doc_md
    ? `\n\nWORKSPACE KNOWLEDGE BASE:\n${workspace.soul_doc_md}`
    : '\n\nWORKSPACE KNOWLEDGE BASE: Not yet generated. Use only the document excerpts below.';

  // Layer 3: RAG chunks (semantic search, top 20)
  const searchResults = await searchWorkspaceChunks(workspace.id, userMessage, {
    matchCount: 20,
    threshold: 0.25,
  });

  const retrievedChunkIds = searchResults.map(r => r.id);

  const chunksSection = searchResults.length > 0
    ? `\n\nRELEVANT DOCUMENT EXCERPTS (cite these using [DOC:document-id:chunk-index]):\n` +
      searchResults.map(r =>
        `[DOC:${r.document_id}:${r.chunk_index}] From "${r.document_title}" (relevance: ${(r.similarity * 100).toFixed(0)}%):\n${r.chunk_text}`
      ).join('\n---\n')
    : '\n\nNO DOCUMENTS AVAILABLE — Inform the user that no documents have been uploaded to this workspace yet.';

  const systemPrompt = baseInstructions + soulSection + chunksSection;

  return { systemPrompt, retrievedChunkIds };
}
