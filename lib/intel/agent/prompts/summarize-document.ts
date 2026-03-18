export function getSummarizeDocumentSystemPrompt(orgName: string, focusAreas: string): string {
  return `You are a document analyst for ${orgName}. The organization focuses on: ${focusAreas}. Analyze the uploaded document and produce a structured JSON summary. Return ONLY valid JSON, no markdown formatting or code blocks.`;
}

export function getSummarizeDocumentUserPrompt(text: string): string {
  return `Analyze this document and return a JSON object with these fields:
{
  "title": "document title",
  "doc_type": "legislation|regulation|academic|report|opinion|position_paper|other",
  "date": "publication date if found, or null",
  "author": "author if found, or null",
  "key_topics": ["topic1", "topic2", "topic3"],
  "executive_summary": "3-5 sentence summary",
  "detailed_summary": "1-2 page structured summary of key points",
  "key_quotes": [{"quote": "exact quote", "context": "why it matters"}],
  "relevance_to_org": "Brief assessment of how relevant this is to the organization",
  "actionable_items": ["actionable item 1", "actionable item 2"]
}

Document text:
${text}`;
}
