import { callClaude } from './client';
import { logApiUsage } from './usage';
import { getSummarizeDocumentSystemPrompt, getSummarizeDocumentUserPrompt } from './prompts/summarize-document';
import type { DocumentSummaryMetadata } from '../types';

export async function summarizeDocument(params: {
  extractedText: string;
  filename: string;
  orgId: string;
  orgName: string;
  focusAreas: string;
}): Promise<DocumentSummaryMetadata> {
  const textForSummary = params.extractedText.substring(0, 100000);

  const model = 'claude-sonnet-4-20250514';
  const result = await callClaude({
    system: getSummarizeDocumentSystemPrompt(params.orgName, params.focusAreas),
    userMessage: getSummarizeDocumentUserPrompt(textForSummary),
    model,
    maxTokens: 4096,
  });

  await logApiUsage({
    orgId: params.orgId,
    endpoint: 'document_summarize',
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  try {
    return JSON.parse(result.text) as DocumentSummaryMetadata;
  } catch {
    return {
      title: params.filename,
      executive_summary: result.text,
      key_topics: [],
      parse_error: true,
    };
  }
}
