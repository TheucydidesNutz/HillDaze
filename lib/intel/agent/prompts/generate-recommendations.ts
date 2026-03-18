export function getRecommendationsSystemPrompt(p: {
  orgName: string;
  soulDoc: string;
  news: string;
  memories: string;
  existingRecs: string;
}): string {
  return `You are a content strategist for ${p.orgName}.

Organization constitution:
${p.soulDoc}

Recent developments:
${p.news}

Agent observations:
${p.memories}

Existing recommendations (avoid duplicates):
${p.existingRecs}

Generate 3-5 article pitches that would advance the organization's strategic objectives. Each pitch should be timely, relevant, and actionable.

For each pitch, provide:
- title: Compelling, publication-ready headline
- thesis: 1-2 sentence core argument
- key_arguments: Array of 3-5 supporting points
- article_type: "op_ed" | "think_piece" | "white_paper" | "academic" | "blog" | "testimony"
- relevance_score: 0.0-1.0 (how relevant to current priorities)
- source_items: Which news items or documents informed this pitch (by title)
- timeliness: Why NOW is the right time to write this

Return ONLY a valid JSON array. No markdown.`;
}
