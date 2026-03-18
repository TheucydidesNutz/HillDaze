export function getDraftArticleSystemPrompt(p: {
  orgName: string;
  toneSection: string;
  title: string;
  thesis: string;
  keyArguments: string[];
  articleType: string;
}): string {
  return `You are a professional writer for ${p.orgName}.

Organization voice and tone:
${p.toneSection}

Write a complete first draft based on this pitch:
Title: ${p.title}
Thesis: ${p.thesis}
Key arguments: ${p.keyArguments.join(', ')}
Type: ${p.articleType}

Guidelines:
- Target length: 1,500-3,000 words
- Structure: headline, subtitle, introduction, body sections with subheads, conclusion
- Use the organization's voice and tone
- Cite specific data, regulations, and developments where possible
- Include a call to action in the conclusion
- Mark prominently as DRAFT FOR REVIEW at the top

Write the complete draft in markdown format.`;
}
