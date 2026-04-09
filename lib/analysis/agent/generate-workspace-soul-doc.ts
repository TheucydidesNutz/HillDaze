import { supabaseAdmin } from '@/lib/supabase';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import type { Workspace } from '../types';

export async function generateWorkspaceSoulDoc(
  workspace: Workspace,
  orgId: string
): Promise<{ content: Record<string, unknown>; markdown: string }> {
  // Fetch document summaries
  const { data: docs } = await supabaseAdmin
    .from('workspace_documents')
    .select('id, title, summary, metadata, source_type, folder, created_at')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(200);

  const documents = docs || [];

  if (documents.length === 0) {
    return {
      content: { status: 'empty', message: 'No documents available for synthesis' },
      markdown: '# Workspace Knowledge Base\n\nNo documents have been uploaded yet.',
    };
  }

  const docContext = documents.map(doc =>
    `## "${doc.title}" (${doc.source_type}, folder: ${doc.folder || 'General'})\n${doc.summary || 'No summary available'}`
  ).join('\n\n---\n\n');

  const model = 'claude-sonnet-4-20250514';
  const result = await callClaude({
    system: `You are synthesizing a comprehensive knowledge base document for the workspace "${workspace.name}". ${workspace.description || ''} This document will serve as the always-available context for AI conversations about this workspace's topic.`,
    userMessage: `Based on the following ${documents.length} documents, create:

1. A structured JSON object capturing the key knowledge, themes, and relationships
2. A comprehensive markdown document that summarizes everything known about this workspace's topic

Return ONLY valid JSON with this structure:
{
  "json": {
    "overview": "2-3 paragraph overview of the workspace's domain",
    "key_themes": [{"theme": "name", "description": "...", "supporting_docs": ["doc titles"]}],
    "key_entities": [{"name": "...", "role": "...", "relevance": "..."}],
    "relationships": [{"from": "...", "to": "...", "nature": "..."}],
    "timeline": [{"date": "...", "event": "..."}],
    "open_questions": ["..."],
    "confidence_level": "high|medium|low",
    "document_count": ${documents.length}
  },
  "markdown": "# Knowledge Base for ${workspace.name}\\n\\n..."
}

Documents:
${docContext}`,
    model,
    maxTokens: 8192,
  });

  await logApiUsage({
    orgId,
    endpoint: 'workspace_soul_doc_generation',
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  try {
    const parsed = JSON.parse(result.text);
    return {
      content: parsed.json || parsed,
      markdown: parsed.markdown || result.text,
    };
  } catch {
    return {
      content: { raw: result.text },
      markdown: result.text,
    };
  }
}
