import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { searchWorkspaceChunks } from '../workspace-rag';
import type { Workspace, WorkspaceReportTemplate } from '../types';

export async function generateWorkspaceReport(
  workspace: Workspace,
  template: WorkspaceReportTemplate,
  orgId: string,
  additionalContext?: string
): Promise<{ content: string; metadata: Record<string, unknown> }> {
  // Load example reports for structure/tone analysis
  const examples = template.example_reports || [];
  const examplesSection = examples.length > 0
    ? `\n\nEXAMPLE REPORTS (match this structure, tone, and format):\n` +
      examples.map((ex, i) =>
        `--- Example ${i + 1}: "${ex.title}" ${ex.date ? `(${ex.date})` : ''} ---\n${ex.content}`
      ).join('\n\n')
    : '';

  // Soul doc for context
  const soulDocSection = workspace.soul_doc_md
    ? `\n\nWORKSPACE KNOWLEDGE BASE:\n${workspace.soul_doc_md}`
    : '';

  // RAG search using generation prompt or template name as query
  const searchQuery = template.generation_prompt || template.name;
  const chunks = await searchWorkspaceChunks(workspace.id, searchQuery, {
    matchCount: 25,
    threshold: 0.2,
  });

  const chunksSection = chunks.length > 0
    ? `\n\nRELEVANT DOCUMENT DATA:\n` +
      chunks.map(c => `From "${c.document_title}":\n${c.chunk_text}`).join('\n---\n')
    : '';

  const model = 'claude-opus-4-20250514';
  const result = await callClaude({
    system: `You are a professional report writer for the "${workspace.name}" workspace. ${workspace.description || ''} Generate a polished, professional report based on the provided data and examples.`,
    userMessage: `Generate a new report for template: "${template.name}"
${template.description ? `\nTemplate description: ${template.description}` : ''}
${template.generation_prompt ? `\nSpecific instructions: ${template.generation_prompt}` : ''}
${additionalContext ? `\nAdditional context: ${additionalContext}` : ''}
${examplesSection}
${soulDocSection}
${chunksSection}

Generate the report now. Match the structure and tone of the examples if provided. Use the workspace knowledge base and document data as source material. Cite specific documents where appropriate.`,
    model,
    maxTokens: 8192,
  });

  await logApiUsage({
    orgId,
    endpoint: 'workspace_report_generation',
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return {
    content: result.text,
    metadata: {
      model,
      chunks_used: chunks.length,
      examples_used: examples.length,
      generated_at: new Date().toISOString(),
    },
  };
}
